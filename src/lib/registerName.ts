// How a register is named anywhere outside her own account: "Amina · baby
// things for March", or "Amina's Register" when the title is empty or was
// withheld by the title check (lib/registerTitle). Never a surname.
//
// checkedTitle must already have been through checkLiveTitle; the server
// shapes in lib/publicRegisterShapes do that and send the result as
// displayName, so pages render it and never see a raw title. Pure, so pages
// and the server share it.
export function registerDisplayName(firstName: string, checkedTitle: string | null | undefined): string {
  const t = checkedTitle?.trim();
  return t ? `${firstName} · ${t}` : `${firstName}'s Register`;
}
