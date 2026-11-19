const cap = n => Math.max(0, Math.min(1, n));
const ease = n => { const p = cap(n); return p*p*(3-2*p); };

// Sample the same flight path for the actor and the ribbon behind its hand.
export function flight(t, round, reach) {
  const forward = ease((t-.32)/.21);
  const retreat = ease((t-.64)/.29);
  const travel = forward*(1-retreat);
  const arc = Math.sin(Math.PI*forward)*(1-retreat);
  return {
    x: reach*travel,
    y: arc*[.35, 1.9, 1.15][round],
    z: arc*[.55, -.42, .2][round]
  };
}

