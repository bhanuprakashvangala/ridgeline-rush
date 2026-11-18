'use strict';
// Autopilot used for the title-screen demo and headless balance tests.
(function (RR) {
  function landingSlope(bike, level) {
    let x = bike.c.x, y = bike.c.y, vx = bike.c.vx, vy = bike.c.vy;
    for (let i = 0; i < 150; i++) {
      x += vx * 0.02; vy -= RR.PHYS.G * 0.02; y += vy * 0.02;
      if (y - 0.9 < level.height(x)) break;
    }
    return level.slope(x + 0.5);
  }
  RR.botInput = function (bike, level) {
    const c = bike.c;
    const target = bike.grounded ? level.slope(c.x + 0.8) : landingSlope(bike, level);
    let err = c.a - target;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const pred = err + c.w * 0.25;           // look ahead on pitch rate
    let lean = 0;
    const tol = bike.grounded ? 0.12 : 0.06;
    if (pred > tol) lean = -1;               // nose rising -> lean forward
    else if (pred < -tol - 0.1) lean = 1;    // nose dropping -> lean back
    let gas = true;
    if (bike.grounded && pred > 0.35) gas = false;      // about to loop out: ease off
    if (bike.grounded && target < -0.2 && bike.speed() > 7) gas = false; // steep descent
    const brake = bike.grounded && target < -0.3 && bike.speed() > 8;
    return { gas, brake, lean };
  };
})(window.RR);
