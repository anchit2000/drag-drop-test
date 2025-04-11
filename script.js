const canvas = document.getElementById("canvas");

document.querySelectorAll('.component').forEach(component => {
  component.addEventListener('dragstart', e => {
    e.dataTransfer.setData("text/plain", component.textContent);
  });
});

canvas.addEventListener('dragover', e => {
  e.preventDefault();
});

canvas.addEventListener('drop', e => {
  e.preventDefault();
  const type = e.dataTransfer.getData("text/plain");

  // Adjust drop coordinates relative to canvas
  const canvasRect = canvas.getBoundingClientRect();
  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;

  const block = createBlock(type, x, y);
  canvas.appendChild(block);
});

function createBlock(type, x, y) {
  const block = document.createElement('div');
  block.className = 'block';
  block.style.left = `${x - 90}px`; // centered on cursor
  block.style.top = `${y - 30}px`;
  block.textContent = type;

  // Enable dragging within canvas
  block.addEventListener('mousedown', function (e) {
    e.preventDefault(); // Prevent text selection

    const shiftX = e.clientX - block.getBoundingClientRect().left;
    const shiftY = e.clientY - block.getBoundingClientRect().top;

    function moveAt(pageX, pageY) {
      const canvasRect = canvas.getBoundingClientRect();
      block.style.left = `${pageX - canvasRect.left - shiftX}px`;
      block.style.top = `${pageY - canvasRect.top - shiftY}px`;
    }

    function onMouseMove(e) {
      moveAt(e.pageX, e.pageY);
    }

    document.addEventListener('mousemove', onMouseMove);

    document.addEventListener('mouseup', function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    });
  });

  block.ondragstart = () => false;

  return block;
}
