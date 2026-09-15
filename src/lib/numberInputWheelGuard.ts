/**
 * Native number inputs change their value when the wheel is used while the
 * field is focused. Prevent only that browser default; keyboard entry and the
 * native spinner controls remain untouched.
 */
export function preventFocusedNumberInputWheelChange(event: WheelEvent) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== 'number' || document.activeElement !== target) return;

  event.preventDefault();
}

export function installNumberInputWheelGuard() {
  document.addEventListener('wheel', preventFocusedNumberInputWheelChange, {
    capture: true,
    passive: false,
  });

  return () => {
    document.removeEventListener('wheel', preventFocusedNumberInputWheelChange, true);
  };
}
