const cards = document.querySelectorAll("[data-card]");

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEWBOX_SIZE = 200;

cards.forEach((card) => {
  const codeElement = card.querySelector("pre code");
  const svg = card.querySelector("svg");
  const hint = card.querySelector(".copy-hint");

  if (!codeElement || !svg) {
    return;
  }

  const code = codeElement.textContent.trim();
  const defaultHint = hint ? hint.textContent : "Click to copy";

  renderPreview(svg, code);

  const copyHandler = () => {
    copyToClipboard(code)
      .then(() => {
        card.classList.add("is-copied");
        if (hint) {
          hint.textContent = "Copied";
        }
        window.setTimeout(() => {
          card.classList.remove("is-copied");
          if (hint) {
            hint.textContent = defaultHint;
          }
        }, 1400);
      })
      .catch(() => {
        if (hint) {
          hint.textContent = "Copy failed";
        }
        window.setTimeout(() => {
          if (hint) {
            hint.textContent = defaultHint;
          }
        }, 1400);
      });
  };

  card.addEventListener("click", copyHandler);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      copyHandler();
    }
  });
});

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function renderPreview(svg, code) {
  const paths = simulateTurtle(code);
  if (!paths.length) {
    return;
  }

  const pathData = buildPathData(paths);
  if (!pathData) {
    return;
  }

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  svg.setAttribute("viewBox", `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`);
  svg.replaceChildren(path);
}

function simulateTurtle(code) {
  const lines = code.split(/\r?\n/);
  const parsed = parseBlock(lines, 0, 0);

  const state = {
    x: 0,
    y: 0,
    heading: 0,
    penDown: true,
    currentPath: null,
    paths: [],
  };

  runNodes(parsed.nodes, {}, state);

  return state.paths;
}

function parseBlock(lines, startIndex, indentLevel) {
  const nodes = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }

    const indent = getIndent(rawLine);
    if (indent < indentLevel) {
      break;
    }

    if (indent > indentLevel) {
      index += 1;
      continue;
    }

    const forMatch = trimmed.match(/^for\s+(\w+)\s+in\s+range\(([^)]*)\):$/);
    if (forMatch) {
      const varName = forMatch[1];
      const rangeArgs = parseRangeArgs(forMatch[2]);
      const body = parseBlock(lines, index + 1, indentLevel + 4);
      nodes.push({ type: "for", varName, rangeArgs, body: body.nodes });
      index = body.nextIndex;
      continue;
    }

    const command = parseCommand(trimmed);
    if (command) {
      nodes.push({ type: "cmd", ...command });
    }

    index += 1;
  }

  return { nodes, nextIndex: index };
}

function getIndent(line) {
  const match = line.match(/^\s*/);
  if (!match) {
    return 0;
  }
  return match[0].replace(/\t/g, "    ").length;
}

function parseRangeArgs(argString) {
  const parts = argString.split(",").map((part) => part.trim()).filter(Boolean);
  const numbers = parts.map((value) => parseFloat(value));

  if (numbers.length === 1) {
    return { start: 0, stop: numbers[0], step: 1 };
  }
  if (numbers.length === 2) {
    return { start: numbers[0], stop: numbers[1], step: 1 };
  }
  if (numbers.length >= 3) {
    return { start: numbers[0], stop: numbers[1], step: numbers[2] };
  }

  return { start: 0, stop: 0, step: 1 };
}

function parseCommand(line) {
  const turtleMatch = line.match(/^t\.(\w+)\(([^)]*)\)$/);
  if (!turtleMatch) {
    return null;
  }

  const name = turtleMatch[1];
  const args = turtleMatch[2].split(",").map((part) => part.trim()).filter(Boolean);

  if (name === "speed" || name === "done") {
    return null;
  }

  return { name, args };
}

function runNodes(nodes, env, state) {
  nodes.forEach((node) => {
    if (node.type === "for") {
      const { start, stop, step } = node.rangeArgs;
      if (!Number.isFinite(step) || step === 0) {
        return;
      }
      const stepDirection = step > 0 ? 1 : -1;
      const condition = (value) => (stepDirection > 0 ? value < stop : value > stop);

      for (let value = start; condition(value); value += step) {
        const previousValue = env[node.varName];
        env[node.varName] = value;
        runNodes(node.body, env, state);
        if (previousValue === undefined) {
          delete env[node.varName];
        } else {
          env[node.varName] = previousValue;
        }
      }
      return;
    }

    if (node.type === "cmd") {
      executeCommand(node, env, state);
    }
  });
}

function executeCommand(command, env, state) {
  switch (command.name) {
    case "forward": {
      const distance = evaluateExpression(command.args[0], env);
      const angle = (state.heading * Math.PI) / 180;
      const nextX = state.x + Math.cos(angle) * distance;
      const nextY = state.y + Math.sin(angle) * distance;
      drawTo(nextX, nextY, state);
      break;
    }
    case "backward": {
      const distance = evaluateExpression(command.args[0], env);
      const angle = (state.heading * Math.PI) / 180;
      const nextX = state.x - Math.cos(angle) * distance;
      const nextY = state.y - Math.sin(angle) * distance;
      drawTo(nextX, nextY, state);
      break;
    }
    case "right": {
      const angle = evaluateExpression(command.args[0], env);
      state.heading -= angle;
      break;
    }
    case "left": {
      const angle = evaluateExpression(command.args[0], env);
      state.heading += angle;
      break;
    }
    case "goto": {
      const nextX = evaluateExpression(command.args[0], env);
      const nextY = evaluateExpression(command.args[1], env);
      drawTo(nextX, nextY, state);
      if (!state.penDown) {
        state.currentPath = null;
      }
      break;
    }
    case "penup":
      state.penDown = false;
      state.currentPath = null;
      break;
    case "pendown":
      state.penDown = true;
      break;
    case "circle": {
      const radius = evaluateExpression(command.args[0], env);
      drawCircle(radius, state);
      break;
    }
    default:
      break;
  }
}

function evaluateExpression(expression, env) {
  if (!expression) {
    return 0;
  }

  const value = expression.trim();
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number.parseFloat(value);
  }

  const sign = value.startsWith("-") ? -1 : 1;
  const variable = value.replace(/^-/, "");
  if (env[variable] !== undefined) {
    return sign * env[variable];
  }

  return 0;
}

function drawTo(x, y, state) {
  if (state.penDown) {
    if (!state.currentPath) {
      state.currentPath = [[state.x, state.y]];
      state.paths.push(state.currentPath);
    }
    state.currentPath.push([x, y]);
  }

  state.x = x;
  state.y = y;
}

function drawCircle(radius, state) {
  const steps = 72;
  const direction = radius >= 0 ? 1 : -1;
  const stepAngle = (360 / steps) * direction;
  const stepLength = (2 * Math.PI * Math.abs(radius)) / steps;

  for (let i = 0; i < steps; i += 1) {
    const angle = (state.heading * Math.PI) / 180;
    const nextX = state.x + Math.cos(angle) * stepLength;
    const nextY = state.y + Math.sin(angle) * stepLength;
    drawTo(nextX, nextY, state);
    state.heading += stepAngle;
  }
}

function buildPathData(paths) {
  const points = paths.flat();
  if (!points.length) {
    return "";
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padding = 18;
  const scale = Math.min((VIEWBOX_SIZE - padding * 2) / width, (VIEWBOX_SIZE - padding * 2) / height);
  const offsetX = (VIEWBOX_SIZE - width * scale) / 2;
  const offsetY = (VIEWBOX_SIZE - height * scale) / 2;

  const mapPoint = ([x, y]) => {
    const mappedX = offsetX + (x - minX) * scale;
    const mappedY = VIEWBOX_SIZE - (offsetY + (y - minY) * scale);
    return [mappedX, mappedY];
  };

  const segments = paths
    .filter((path) => path.length > 1)
    .map((path) => {
      const [first, ...rest] = path.map(mapPoint);
      const commands = [`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`];
      rest.forEach(([x, y]) => {
        commands.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
      });
      return commands.join(" ");
    });

  return segments.join(" ");
}

const starterCopyButton = document.querySelector("[data-copy-button]");
const starterCodeElement = document.querySelector("[data-copy-code]");

if (starterCopyButton && starterCodeElement) {
  const starterCode = starterCodeElement.textContent.trim();
  const defaultButtonLabel = starterCopyButton.textContent;

  starterCopyButton.addEventListener("click", () => {
    copyToClipboard(starterCode)
      .then(() => {
        starterCopyButton.textContent = "Copied";
        window.setTimeout(() => {
          starterCopyButton.textContent = defaultButtonLabel;
        }, 1400);
      })
      .catch(() => {
        starterCopyButton.textContent = "Copy failed";
        window.setTimeout(() => {
          starterCopyButton.textContent = defaultButtonLabel;
        }, 1400);
      });
  });
}
