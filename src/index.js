import '../js/util.js';
import '../js/levels.js';
import '../js/physics.js';
import '../js/bot.js';
import '../js/audio.js';
import { Game } from './game.js';

const start = () => { window.RR.game = new Game(); };
if (document.fonts && document.fonts.load) {
  Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 20px Rajdhani`))).then(start, start);
} else start();
