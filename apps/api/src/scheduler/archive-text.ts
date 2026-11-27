import { inflateCapped } from "./capped-inflate";
import { ReadLater } from "./read-later";
import { isTar, tarEntries } from "./tar-entries";
import { zipEntries } from "./zip-entries";

/**
 * An archive is refused whole when it has more entries than this, unpacks to
 * more bytes than this, or holds archives nested deeper than this. The counts
 * are for the archive and every archive inside it together. Its text is never
 * cut: every member with a reader is read whole.
 */
export const ARCHIVE_CAPS = {
  entries: 5000,
  bytes: 500_000_000,
  depth: 3,
};
type Caps = typeof ARCHIVE_CAPS;

export const ARCHIVE = /\.(zip|tar|tgz|gz)$/i;

/** A cap was passed: the archive is not read, a member is not just skipped. */
class ArchiveRefused extends Error {}

/** Which members have a reader, and the words of one of them. */
export type MemberReader = {
  readable: (path: string) => boolean;
  read: (path: string, bytes: Uint8Array) => Promise<string>;
};

type Budget = { entries: number; bytes: number; caps: Caps };
// Unpacked only when it is read. Throws when it unpacks past its size.
type Member = { path: string; open: () => Uint8Array };
// macOS adds these to zips and tars: resource forks, not files.
const JUNK = /(^|\/)(__MACOSX\/|\._)/;

const spend = (budget: Budget, entries: number, bytes: number) => {
  budget.entries += entries;
  budget.bytes += bytes;
  if (budget.entries > budget.caps.entries) {
    throw new ArchiveRefused("The archive has too many entries");
  }
  if (budget.bytes > budget.caps.bytes) {
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

async function collect(
  name: string,
  prefix: string,
  bytes: Uint8Array,
  reader: MemberReader,
  budget: Budget,
  depth: number,
  found: string[],
) {
  const isArchive = (path: string) => ARCHIVE.test(path);
  const wanted = (path: string) => isArchive(path) || reader.readable(path);
  for (const member of unpack(name, bytes, wanted, budget)) {
    const path = `${prefix}${member.path}`;
    // Outside skipBroken: a member that unpacks past its stated size refuses
    // the archive it is in.
    const data = member.open();
    if (isArchive(member.path)) {
      if (depth >= budget.caps.depth) {
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
    found.push(`File ${path}:\n${text}`);
  }
}

/**
 * A member that cannot be read is skipped; a passed cap refuses the archive,
 * and a model that cannot answer now leaves the archive to be read later.
 */
async function skipBroken<T>(next: () => Promise<T>) {
  try {
    return await next();
  } catch (error) {
    if (error instanceof ArchiveRefused || error instanceof ReadLater) {
      throw error;
    }
    return undefined;
  }
}

/**
 * The words of every member of a zip, gzip or tar archive that has a reader,
 * each under a line with its path. Archives inside are read too, up to the
 * nesting cap. Reads the bytes in memory only: nothing is written to disk,
 * and each member is unpacked when it is read and let go after. Throws on
 * bytes that are not an archive, or an archive that passes a cap.
 */
export async function archiveText(
  name: string,
  bytes: Uint8Array,
  reader: MemberReader,
  caps: Caps = ARCHIVE_CAPS,
) {
  const found: string[] = [];
  await collect(
    name,
    "",
    bytes,
    reader,
    { entries: 0, bytes: 0, caps },
    1,
    found,
  );
  return found.join("\n\n");
}
