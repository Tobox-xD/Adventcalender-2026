/**
 * Removes a solid black background from a pixel-art sprite image by
 * flood-filling from the outer edges on an offscreen canvas.
 * Preserves dark interior pixels (such as eyes and outlines).
 */
export function removeBlackBackground(src, threshold = 26) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(src);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(src);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const total = width * height;
      const visited = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;

      const isNearBlack = (pixelIdx) => {
        const offset = pixelIdx * 4;
        return (
          data[offset] <= threshold &&
          data[offset + 1] <= threshold &&
          data[offset + 2] <= threshold
        );
      };

      const enqueue = (x, y) => {
        const idx = y * width + x;
        if (visited[idx] || !isNearBlack(idx)) return;
        visited[idx] = 1;
        queue[tail++] = idx;
      };

      // Seed flood-fill from all 4 outer borders
      for (let x = 0; x < width; x += 1) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }
      for (let y = 1; y < height - 1; y += 1) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }

      while (head < tail) {
        const idx = queue[head++];
        data[idx * 4 + 3] = 0;

        const x = idx % width;
        const y = (idx - x) / width;

        if (x > 0) enqueue(x - 1, y);
        if (x + 1 < width) enqueue(x + 1, y);
        if (y > 0) enqueue(x, y - 1);
        if (y + 1 < height) enqueue(x, y + 1);
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(src);
    img.src = src;
  });
}
