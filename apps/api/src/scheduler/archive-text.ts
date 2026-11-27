import { inflateCapped } from "./capped-inflate";
import { isTar, tarEntries } from "./tar-entries";
import { zipEntries } from "./zip-entries";

// An archive is refused whole when it has more entries than this, unpacks to
// more bytes than this, or holds archives nested deeper than this. The counts
// are for the archive and every archive inside it together.
const MAX_ARCHIVE_ENTRIES = 200;
const MAX_ARCHIVE_BYTES = 50_000_000;
const MAX_ARCHIVE_DEPTH = 2;
// The text of an archive's members is read up to this many characters.
const MAX_ARCHIVE_CHARS = 200_000;

export const ARCHIVE = /\.(zip|tar|tgz|gz)$/i;

/** A cap was passed: the archive is not read, a member is not just skipped. */
class ArchiveRefused extends Error {}

/** Which members have a reader, and the words of one of them. */
export type MemberReader = {
  readable: (path: string) => boolean;
  read: (path: string, bytes: Uint8Array) => Promise<string>;
};

type Budget = { entries: number; bytes: number };
// Unpacked only when it is read. Throws when it unpacks past its size.
type Member = { path: string; open: () => Uint8Array };
// macOS adds these to zips and tars: resource forks, not files.
const JUNK = /(^|\/)(__MACOSX\/|\._)/;

const spend = (budget: Budget, entries: number, bytes: number) => {
  budget.entries += entries;
  budget.bytes += bytes;
  if (budget.entries > MAX_ARCHIVE_ENTRIES) {
    throw new ArchiveRefused("The archive has too many entries");
  }
  if (budget.bytes > MAX_ARCHIVE_BYTES) {
    throw new ArchiveRefused("The archive unpacks past the size cap");
  }
};

/**
 * The members of an archive that a reader wants. Every entry counts against
 * the budget, by the larger of its stored and declared size, before anything
 * is unpacked.
 */
function unpack(
  name: string,
  bytes: Uint8Array,
  wanted: (path: string) => boolean,
  budget: Budget,
): Member[] {
  const want = (path: string) =>
    !path.endsWith("/") && !JUNK.test(path) && wanted(path);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const members: Member[] = [];
    for (const entry of zipEntries(bytes)) {
      spend(budget, 1, entry.size);
      if (want(entry.path)) members.push(entry);
    }
    return members;
  }
  if (bytes[0] === 0x1f && bytes[1] === 0x8b && bytes.length >= 18) {
    // The size of the gzipped file, from its last four bytes.
    const size = new DataView(
      bytes.buffer,
      bytes.byteOffset + bytes.length - 4,
    ).getUint32(0, true);
    spend(budget, 1, size);
    const data = inflateCapped(bytes, size, true);
    if (!isTar(data)) {
      // A gzipped file is named after the file inside: notes.txt.gz.
      const path = name.replace(/\.gz$/i, "");
      return want(path) ? [{ path, open: () => data }] : [];
    }
    return tarMembers(data, want, budget);
  }
  if (isTar(bytes)) return tarMembers(bytes, want, budget);
  throw new Error("Not an archive");
}

function tarMembers(
  bytes: Uint8Array,
  want: (path: string) => boolean,
  budget: Budget,
) {
  const members: Member[] = [];
  for (const entry of tarEntries(bytes)) {
    spend(budget, 1, entry.bytes.length);
    if (entry.file && want(entry.path)) {
      members.push({ path: entry.path, open: () => entry.bytes });
    }
  }
  return members;
}

type Found = { texts: string[]; length: number };

async function collect(
  name: string,
  prefix: string,
  bytes: Uint8Array,
  reader: MemberReader,
  budget: Budget,
  depth: number,
  found: Found,
) {
  const isArchive = (path: string) => ARCHIVE.test(path);
  const wanted = (path: string) => isArchive(path) || reader.readable(path);
  for (const member of unpack(name, bytes, wanted, budget)) {
    if (found.length >= MAX_ARCHIVE_CHARS) return;
    const path = `${prefix}${member.path}`;
    // Outside skipBroken: a member that unpacks past its stated size refuses
    // the archive it is in.
    const data = member.open();
    if (isArchive(member.path)) {
      if (depth >= MAX_ARCHIVE_DEPTH) {
        throw new ArchiveRefused("The archive is nested too deep");
      }
      await skipBroken(() =>
        collect(
          member.path,
          `${path}/`,
          data,
          reader,
          budget,
          depth + 1,
          found,
        ),
      );
      continue;
    }
    const text = await skipBroken(() => reader.read(member.path, data));
    if (!text?.trim()) continue;
    const entry = `File ${path}:\n${text}`;
    found.texts.push(entry);
    found.length += entry.length + 2;
  }
}

/** A member that cannot be read is skipped; a passed cap refuses the archive. */
async function skipBroken<T>(next: () => Promise<T>) {
  try {
    return await next();
  } catch (error) {
    if (error instanceof ArchiveRefused) throw error;
    return undefined;
  }
}

/**
 * The words of every member of a zip, gzip or tar archive that has a reader,
 * each under a line with its path. Archives inside are read too, up to the
 * nesting cap. Reads the bytes only. Throws on bytes that are not an archive,
 * or an archive that passes a cap.
 */
export async function archiveText(
  name: string,
  bytes: Uint8Array,
  reader: MemberReader,
) {
  const found: Found = { texts: [], length: 0 };
  await collect(name, "", bytes, reader, { entries: 0, bytes: 0 }, 1, found);
  return found.texts.join("\n\n").slice(0, MAX_ARCHIVE_CHARS);
}
