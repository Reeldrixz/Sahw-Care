// Pages drawn without the site's chrome (header, footer, beta banner and
// pill, onboarding modal): the broadcast overlay is a browser source in the
// host's streaming software, composited over video, so anything else on the
// page would go out on air — including the signed-in user's name.
export function isChromeless(pathname: string | null): boolean {
  return !!pathname && pathname.startsWith("/overlay/");
}
