const canvas = document.getElementById("canvas");
const svg = document.getElementById("connection-layer");

let blocks = []; // To store all blocks
let connections = []; // To store all connections
let isDraggingConnector = false; // Flag for connector dragging state

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

  canvas.querySelector(".markdown-display-toggle").addEventListener("click", () => {
    const previewDiv = canvas.querySelector(".markdown-preview");
    const textarea = canvas.querySelector(".markdown-editor");
    const previewButton = canvas.querySelector(".markdown-display-toggle")

    if (previewDiv.style.display === 'none') {
      previewDiv.innerHTML = marked.parse(textarea.value);
      previewDiv.style.display = 'block';
      textarea.style.display = 'none';
      previewButton.textContent = 'Edit';
    } else {
      previewDiv.style.display = 'none';
      textarea.style.display = 'block';
      previewButton.textContent = 'Preview';
    }
  });
});

// 2. Make block draggable (but not when clicking a connector)
function makeDraggable(block) {
  let isDragging = false;

  block.addEventListener('mousedown', e => {
    // Prevent dragging if we're on a connector or if we're already dragging a connector
    if (e.target.classList.contains('connector') || isDraggingConnector) return;

    isDragging = true;
    const shiftX = e.clientX - block.getBoundingClientRect().left;
    const shiftY = e.clientY - block.getBoundingClientRect().top;

    // Update block position in our data model
    const blockData = blocks.find(b => b.id === block.dataset.id);
    if (blockData) {
      blockData.position.x = parseFloat(block.style.left) || 0;
      blockData.position.y = parseFloat(block.style.top) || 0;
    }

    const onMouseMove = e => {
      if (!isDragging) return;

      const canvasRect = canvas.getBoundingClientRect();
      const newLeft = e.clientX - canvasRect.left - shiftX;
      const newTop = e.clientY - canvasRect.top - shiftY;
      
      // Apply the new position
      block.style.left = `${newLeft}px`;
      block.style.top = `${newTop}px`;
      
      // Update our data model
      if (blockData) {
        blockData.position.x = newLeft;
        blockData.position.y = newTop;
      }
      
      // Update all connections related to this block
      updateBlockConnections(block.dataset.id);
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

function getConnectorPosition(connector) {
  const rect = connector.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  
  return {
    x: rect.left + rect.width / 2 - svgRect.left,
    y: rect.top + rect.height / 2 - svgRect.top
  };
}

// 4. Handle mouse-based connections with improved handling
let fromConnector = null;
let tempLine = null;

document.addEventListener('mousedown', e => {
  if (e.target.classList.contains('connector') && e.target.classList.contains('out')) {
    e.stopPropagation(); // Prevent block dragging
    isDraggingConnector = true;
    fromConnector = e.target;
    const pos = getConnectorPosition(fromConnector);
    tempLine = createLine(pos.x, pos.y, pos.x, pos.y);
  }
});

document.addEventListener('mousemove', e => {
  if (tempLine && isDraggingConnector) {
    const svgRect = svg.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    tempLine.setAttribute("x2", x);
    tempLine.setAttribute("y2", y);
  }
});

document.addEventListener('mouseup', e => {
  if (tempLine && isDraggingConnector) {
    if (e.target.classList.contains('connector') && e.target.classList.contains('in')) {
      const toConnector = e.target;
      
      // Prevent connecting to the same block
      const fromBlockId = fromConnector.closest('.block').dataset.id;
      const toBlockId = toConnector.closest('.block').dataset.id;
      
      if (fromBlockId === toBlockId) {
        svg.removeChild(tempLine);
        tempLine = null;
        fromConnector = null;
        isDraggingConnector = false;
        return;
      }

      const fromPos = getConnectorPosition(fromConnector);
      const toPos = getConnectorPosition(toConnector);

      tempLine.setAttribute("x1", fromPos.x);
      tempLine.setAttribute("y1", fromPos.y);
      tempLine.setAttribute("x2", toPos.x);
      tempLine.setAttribute("y2", toPos.y);

      // Store connection data
      connections.push({
        from: {
          blockId: fromBlockId,
          port: "out"
        },
        to: {
          blockId: toBlockId,
          port: "in"
        },
        line: tempLine
      });
    } else {
      // If we didn't end on a valid connector, remove the temp line
      svg.removeChild(tempLine);
    }
    
    tempLine = null;
    fromConnector = null;
    isDraggingConnector = false;
  }
});

// 5. Update connections for a specific block
function updateBlockConnections(blockId) {
  connections.forEach(conn => {
    if (conn.from.blockId === blockId || conn.to.blockId === blockId) {
      const fromBlock = document.querySelector(`[data-id="${conn.from.blockId}"]`);
      const toBlock = document.querySelector(`[data-id="${conn.to.blockId}"]`);
      
      if (!fromBlock || !toBlock) return;
      
      const fromConnector = fromBlock.querySelector(`.connector.out`);
      const toConnector = toBlock.querySelector(`.connector.in`);
      
      if (!fromConnector || !toConnector) return;
      
      const fromPos = getConnectorPosition(fromConnector);
      const toPos = getConnectorPosition(toConnector);
      
      if (conn.line) {
        conn.line.setAttribute("x1", fromPos.x);
        conn.line.setAttribute("y1", fromPos.y);
        conn.line.setAttribute("x2", toPos.x);
        conn.line.setAttribute("y2", toPos.y);
      }
    }
  });
}

// 6. Export flow data
function exportFlow(toDownload=false) {

  // Update block data from UI
  blocks.forEach(block => {
    const el = document.querySelector(`[data-id="${block.id}"]`);
    if (!el) return;
    
    // Update position
    block.position = {
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0
    };
    
    // Update block-specific data
    if (block.type === 'agent') {
      block.data = {
        model: el.querySelector('select')?.value || '',
        instructions: el.querySelector('textarea')?.value || ''
      };
    } else if (block.type === 'calculator') {
      block.data = {
        expression: el.querySelector('input')?.value || ''
      };
    } else if (block.type === 'url') {
      block.data = {
        url: el.querySelector('input')?.value || ''
      };
    } else if (block.type === 'chat-input') {
      block.data = {
        input: el.querySelector('input')?.value || ''
      };
    } else if (block.type === 'chat-output') {
      block.data = {
        response: el.querySelector('textarea')?.value || ''
      };
    } else if (block.type === 'read-me') {
      block.data = {
        response: el.querySelector('textarea')?.value || ''
      };
    }
    // Add more types as needed
  });

  // Clean connection data for export (remove DOM references)
  const cleanConnections = connections.map(conn => ({
    from: conn.from,
    to: conn.to
  }));

  const flowJSON = JSON.stringify({ blocks, connections: cleanConnections }, null, 2);
  
  if (toDownload) {
    // Create and trigger download
    const blob = new Blob([flowJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flow.json";
    a.click();
    URL.revokeObjectURL(url); 
  }

  return flowJSON;
}

// 7. Import JSON flow
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
      } else if (blockData.type === 'url') {
        wrapper.querySelector('input').value = blockData.data.url || '';
      } else if (blockData.type === 'chat-input') {
        wrapper.querySelector('input').value = blockData.data.input || '';
      } else if (blockData.type === 'chat-output') {
        wrapper.querySelector('textarea').value = blockData.data.response || '';
      } else if (blockData.type === 'read-me') {
        wrapper.querySelector('textarea').value = blockData.data.response || '';
      }

      canvas.appendChild(wrapper);
      makeDraggable(wrapper);
      blocks.push(blockData);
    }

    // Recreate connections
    for (const conn of flow.connections) {
      const fromBlock = document.querySelector(`[data-id="${conn.from.blockId}"]`);
      const toBlock = document.querySelector(`[data-id="${conn.to.blockId}"]`);
      if (!fromBlock || !toBlock) continue;

      const fromConnector = fromBlock.querySelector(`.connector.${conn.from.port}`);
      const toConnector = toBlock.querySelector(`.connector.${conn.to.port}`);
      if (!fromConnector || !toConnector) continue;

      const fromPos = getConnectorPosition(fromConnector);
      const toPos = getConnectorPosition(toConnector);
      const line = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y);

      connections.push({
        from: conn.from,
        to: conn.to,
        line: line
      });
    }

    console.log("Flow imported successfully with connections.");
  } catch (err) {
    console.error("Error importing flow:", err);
  }
});

// Expose export function to global scope for button access
window.exportFlow = exportFlow;

function processFlow() {
  const flowJSON = exportFlow(toDownload=false);
  // Call API Endpoint here to execute process and create an agent out of it.
}
