/**
 * POI Popup: ColorWheel Component
 * Handles canvas-based HSL color selection.
 */
export class ColorWheel {
  constructor(containerId, initialColor, onSelect) {
    this.container = document.getElementById(containerId);
    this.label = this.container.parentElement.querySelector('.control-label');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.onSelect = onSelect;
    this.size = 120;
    this.radius = this.size / 2;
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.container.appendChild(this.canvas);
    
    this.selectedPos = { x: this.radius, y: this.radius };
    this.currentColor = initialColor || '#ff0000';
    
    this.draw();
    this.initEvents();
  }

  draw() {
    const { ctx, size, radius } = this;
    ctx.clearRect(0, 0, size, size);
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, 'white');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.selectedPos.x, this.selectedPos.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  initEvents() {
    const handleMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
      const dx = clientX - rect.left - this.radius;
      const dy = clientY - rect.top - this.radius;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      const dist = Math.min(this.radius, Math.sqrt(dx*dx + dy*dy));
      const ratio = dist / this.radius;
      const normalizedDx = dx / Math.max(0.1, Math.sqrt(dx*dx + dy*dy));
      const normalizedDy = dy / Math.max(0.1, Math.sqrt(dx*dx + dy*dy));
      this.selectedPos = { x: normalizedDx * dist + this.radius, y: normalizedDy * dist + this.radius };
      const saturation = ratio * 100;
      const lightness = 100 - (ratio * 50);
      const hex = this.hslToHex(angle, saturation, lightness);
      this.currentColor = hex;
      this.updateLabel(hex);
      this.draw();
      this.onSelect(hex);
    };
    this.canvas.addEventListener('mousedown', (e) => {
      handleMove(e);
      const onMouseMove = (ev) => handleMove(ev);
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  updateLabel(hex) {
    if (this.label) {
      const baseText = this.label.textContent.split(':')[0];
      this.label.innerHTML = `${baseText}: <span style="color: ${hex}; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${hex.toUpperCase()}</span>`;
    }
  }

  setColor(hex) {
    this.currentColor = hex;
    const hsl = this.hexToHsl(hex);
    const angleRad = hsl.h * Math.PI / 180;
    const ratio = (100 - hsl.l) / 50;
    const dist = ratio * this.radius;
    this.selectedPos = { x: Math.cos(angleRad) * dist + this.radius, y: Math.sin(angleRad) * dist + this.radius };
    this.updateLabel(hex);
    this.draw();
  }

  hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
}
