/** The port this API listens on, from PORT or the default. */
export function listenPort() {
  return Number(process.env.PORT) || 1337;
}
