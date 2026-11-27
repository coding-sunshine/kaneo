/** Sent once at connect; clients read only the start, so the get_current rule comes first. */
export const SERVER_INSTRUCTIONS =
  "Kaneo is the team's work tracker: tasks, projects, documents and topics. " +
  "Call get_current before you draft or save a document, so you know what is already approved on its topic. " +
  "Only a topic's current document is decided; never present a draft or a waiting proposal as decided. " +
  "Save a text with file_document, then call settle_document only after the author has answered what the draft is. " +
  "Put a file from the conversation into a document with attach_document_file, only when the person asks for it.";
