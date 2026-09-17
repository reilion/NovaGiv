/**
 * What the modal slot renders on every route that is not an intercepted
 * /v/[slug]: nothing. Without this file a hard load of any other page would
 * have no match for the slot at all.
 */
export default function ModalDefault() {
  return null;
}
