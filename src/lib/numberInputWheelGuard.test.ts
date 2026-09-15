import { afterEach, describe, expect, it } from 'vitest';
import { installNumberInputWheelGuard } from './numberInputWheelGuard';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
});

function wheel(element: HTMLElement) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: 100,
  });
  element.dispatchEvent(event);
  return event;
}

describe('global number input wheel guard', () => {
  it('cancels wheel value changes on a focused number input', () => {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '20';
    document.body.append(input);
    input.focus();
    cleanups.push(installNumberInputWheelGuard());

    const event = wheel(input);

    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('20');
  });

  it('does not interfere with text inputs or unfocused number inputs', () => {
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    document.body.append(numberInput, textInput);
    textInput.focus();
    cleanups.push(installNumberInputWheelGuard());

    expect(wheel(numberInput).defaultPrevented).toBe(false);
    expect(wheel(textInput).defaultPrevented).toBe(false);
  });
});
