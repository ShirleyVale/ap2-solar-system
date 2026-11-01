(function (global) {
  'use strict';
  global.WebGLUtils = {
    createWebGL2Context(canvas) {
      return canvas.getContext('webgl2', { antialias: true, alpha: true });
    },
    resizeCanvasToDisplaySize(canvas) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
        return true;
      }
      return false;
    }
  };
})(window);
