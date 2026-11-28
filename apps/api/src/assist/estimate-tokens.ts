/** Rough token count of a text, about four characters a token, rounded up. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
