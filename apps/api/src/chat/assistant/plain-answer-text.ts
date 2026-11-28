const TAG = /<[^>]*>/g;
// Web links, and paths of this app, which chat would turn into cards.
const ADDRESS = /\S*(?:[a-z][a-z0-9+.-]*:\/\/|www\.|\/workspace\/)\S*/gi;

/**
 * Model text made safe to post: no tags, mentions, @channel or @here, no
 * links or app addresses, all on one line. Links in the reply come only from
 * the ids the server gave the model.
 */
export const plainAnswerText = (text: string) =>
  text
    .replace(TAG, " ")
    .replace(ADDRESS, " ")
    .replaceAll("@", "")
    .replace(/\s+/g, " ")
    .trim();
