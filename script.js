const canvas = document.getElementById("canvas");
const svg = document.getElementById("connection-layer");

let blocks = []; // To store of the blocks
let connections = []; // To store all line/block connector mappings

// 1. Handle drag from sidebar to canvas
document.querySelectorAll('.component').forEach(component => {
  component.addEventListener('dragstart', e => {
    e.dataTransfer.setData("block", component.dataset.block);
  });
});

canvas.addEventListener('dragover', e => e.preventDefault());

canvas.addEventListener('drop', async e => {
  e.preventDefault();

  const blockName = e.dataTransfer.getData("block");
  const blockHTML = await fetch(`blocks/${blockName}.html`).then(res => res.text());

  const wrapper = document.createElement("div");
  wrapper.classList.add("block");
  wrapper.innerHTML = blockHTML;
  wrapper.dataset.id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const canvasRect = canvas.getBoundingClientRect();
  wrapper.style.left = `${e.clientX - canvasRect.left - 90}px`;
  wrapper.style.top = `${e.clientY - canvasRect.top - 30}px`;

  blocks.push({
    id: wrapper.dataset.id,
    type: blockName,
    position: {
      x: parseFloat(wrapper.style.left),
      y: parseFloat(wrapper.style.top)
    },
    data: {} // You can populate this later from form fields
  });
  

  makeDraggable(wrapper);
  canvas.appendChild(wrapper);
});

// 2. Make block draggable (but not when clicking a connector)
function makeDraggable(block) {
  let isDragging = false;

  block.addEventListener('mousedown', e => {
    if (e.target.classList.contains('connector')) return; // Ignore connector clicks

    isDragging = true;
    const shiftX = e.clientX - block.getBoundingClientRect().left;
    const shiftY = e.clientY - block.getBoundingClientRect().top;

    const onMouseMove = e => {
      const canvasRect = canvas.getBoundingClientRect();
      block.style.left = `${e.clientX - canvasRect.left - shiftX}px`;
      block.style.top = `${e.clientY - canvasRect.top - shiftY}px`;
      updateConnections(block);
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  block.ondragstart = () => false;
}

// 3. SVG connection logic
function createLine(x1, y1, x2, y2) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", "#00c6ff");
  line.setAttribute("stroke-width", "2");
  svg.appendChild(line);
  return line;
}

function getOffset(el) {
    const rect = el.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
  
    return {
      x: rect.left + rect.width / 2 - svgRect.left,
      y: rect.top + rect.height / 2 - svgRect.top
    };
  }
  

// 4. Handle mouse-based connections
let fromConnector = null;
let tempLine = null;

document.addEventListener('mousedown', e => {
  if (e.target.classList.contains('connector') && e.target.classList.contains('out')) {
    fromConnector = e.target;
    const { x, y } = getOffset(fromConnector);
    tempLine = createLine(x, y, x, y);
  }
});

document.addEventListener('mousemove', e => {
  if (tempLine) {
    const x = e.clientX + window.scrollX;
    const y = e.clientY + window.scrollY;
    tempLine.setAttribute("x2", x);
    tempLine.setAttribute("y2", y);
  }
});

document.addEventListener('mouseup', e => {
  if (tempLine && e.target.classList.contains('connector') && e.target.classList.contains('in')) {
    const toConnector = e.target;

    const fromPos = getOffset(fromConnector);
    const toPos = getOffset(toConnector);

    tempLine.setAttribute("x1", fromPos.x);
    tempLine.setAttribute("y1", fromPos.y);
    tempLine.setAttribute("x2", toPos.x);
    tempLine.setAttribute("y2", toPos.y);

    // Store connection so it can be updated later
    connections.push({
        from: {
          blockId: fromConnector.closest('.block').dataset.id,
          port: "out"
        },
        to: {
          blockId: toConnector.closest('.block').dataset.id,
          port: "in"
        }
      });
      

    tempLine = null;
    fromConnector = null;
  } else if (tempLine) {
    svg.removeChild(tempLine);
    tempLine = null;
    fromConnector = null;
  }
});

// 5. Update all lines linked to a moving block
function updateConnections(block) {
  connections.forEach(conn => {
    if (block.contains(conn.from) || block.contains(conn.to)) {
      const fromPos = getOffset(conn.from);
      const toPos = getOffset(conn.to);
      conn.line.setAttribute("x1", fromPos.x);
      conn.line.setAttribute("y1", fromPos.y);
      conn.line.setAttribute("x2", toPos.x);
      conn.line.setAttribute("y2", toPos.y);
    }
  });
}


function exportFlow() {
    // Optionally update block data here (e.g., from inputs)
    blocks.forEach(block => {
      const el = document.querySelector(`[data-id="${block.id}"]`);
      if (block.type === 'agent') {
        block.data = {
          model: el.querySelector('select')?.value,
          instructions: el.querySelector('textarea')?.value
        };
      } else if (block.type === 'calculator') {
        block.data = {
          expression: el.querySelector('input')?.value
        };
      }
      // Add more types as needed...
    });
  
    const flowJSON = JSON.stringify({ blocks, connections }, null, 2);
    console.log(flowJSON); // Or download / display it

    const blob = new Blob([flowJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "flow.json";
    a.click();

    URL.revokeObjectURL(url); // Clean up
  }
  


// Import JSON flow
document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    try {
      const text = await file.text();
      const flow = JSON.parse(text);
  
      // Clear canvas and reset state
      canvas.innerHTML = '';
      svg.innerHTML = '';
      blocks = [];
      connections = [];
  
      // Recreate blocks
      for (const blockData of flow.blocks) {
        const blockHTML = await fetch(`blocks/${blockData.type}.html`).then(res => res.text());
  
        const wrapper = document.createElement("div");
        wrapper.classList.add("block");
        wrapper.innerHTML = blockHTML;
        wrapper.dataset.id = blockData.id;
  
        wrapper.style.left = `${blockData.position.x}px`;
        wrapper.style.top = `${blockData.position.y}px`;
  
        // Set block-specific data
        if (blockData.type === 'agent') {
          wrapper.querySelector('select').value = blockData.data.model || '';
          wrapper.querySelector('textarea').value = blockData.data.instructions || '';
        } else if (blockData.type === 'calculator') {
          wrapper.querySelector('input').value = blockData.data.expression || '';
        }
  
        canvas.appendChild(wrapper);
        makeDraggable(wrapper);
        blocks.push({
          id: blockData.id,
          type: blockData.type,
          position: blockData.position,
          data: blockData.data
        });
      }
  
      // Recreate connections (from new format)
      for (const conn of flow.connections) {
        const fromBlockId = conn.from.blockId;
        const toBlockId = conn.to.blockId;
  
        const fromBlock = document.querySelector(`[data-id="${fromBlockId}"]`);
        const toBlock = document.querySelector(`[data-id="${toBlockId}"]`);
        if (!fromBlock || !toBlock) continue;
  
        const fromConnector = fromBlock.querySelector(`.connector.${conn.from.port}`);
        const toConnector = toBlock.querySelector(`.connector.${conn.to.port}`);
        if (!fromConnector || !toConnector) continue;
  
        const fromPos = getOffset(fromConnector);
        const toPos = getOffset(toConnector);
        const line = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y);
  
        connections.push({
          from: fromConnector,
          to: toConnector,
          line: line
        });
      }
  
      console.log("Flow imported successfully with connections.");
    } catch (err) {
      console.error("Error importing flow:", err);
    }
  });
  