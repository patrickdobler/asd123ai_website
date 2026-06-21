import { loadModel, processText, isModelLoaded } from './inference.js';

// DOM Elements
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const statusElement = document.getElementById('processingStatus');
const privacyMaskDiv = document.getElementById('privacyMask');
const thresholdInput = document.getElementById('thresholdInput');
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');

// Initialize variables
let currentInput = "";
let settingsVisible = false;
let samples = {};

// Add debounce to input handler
let timeout;
inputText.addEventListener('input', (event) => {
  currentInput = event.target.value;
  statusElement.textContent = 'Processing...';
  clearTimeout(timeout);
  timeout = setTimeout(updateOutput, 300);
});

async function updateOutput() {
  if (!isModelLoaded) {
    statusElement.textContent = 'Loading model...';
    outputText.value = "";
    return;
  }
  
  try {
    const threshold = parseFloat(thresholdInput.value) || 0.01;
    const processed = await processText(currentInput, threshold);
    statusElement.textContent = `Processed ${currentInput.length} characters`;
    outputText.value = processed.maskedText;
    
    privacyMaskDiv.innerHTML = '';
    
    if (processed.replacements.length > 0) {
      processed.replacements.forEach(replacement => {
        const tile = document.createElement('div');
        tile.className = 'bg-gray-800 p-3 rounded-lg border border-white/10 hover:border-white/20 transition duration-200 hover:-translate-y-[2px] hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)]';
        tile.innerHTML = `
          <div class="text-xs text-white/60 mb-1">${replacement.placeholder}</div>
          <div class="text-sm text-white font-medium">${replacement.original}</div>
          <div class="text-xs text-white/40 mt-1">Sensitive Information</div>
          <div class="text-xs text-white/40 mt-1">Activation: ${Math.round(replacement.activation * 100)}%</div>
        `;
        privacyMaskDiv.appendChild(tile);
      });
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'text-center text-white/40 py-4';
      emptyState.textContent = 'No sensitive information detected.';
      privacyMaskDiv.appendChild(emptyState);
    }
  } catch (err) {
    statusElement.textContent = 'Error processing text';
    console.error("Error processing text:", err);
    outputText.value = "Error processing text.";
  }
}

// Settings toggle functionality
settingsButton.addEventListener('click', (e) => {
  settingsVisible = !settingsVisible;
  settingsPanel.classList.toggle('hidden', !settingsVisible);
  e.stopPropagation();
});

document.addEventListener('click', (e) => {
  if (settingsVisible && !settingsPanel.contains(e.target)) {
    settingsPanel.classList.add('hidden');
    settingsVisible = false;
  }
});

// Load sample data from data.jsonl
async function loadSamples() {
  try {
    const response = await fetch('data.jsonl');
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    samples = {};
    lines.forEach(line => {
      const obj = JSON.parse(line);
      samples[obj.title] = obj.text;
    });
  } catch (err) {
    console.error("Error loading samples:", err);
  }
}

// Sample button event listeners
document.getElementById('sampleEmailButton').addEventListener('click', () => {
  if (samples["customer email"]) {
    inputText.value = samples["customer email"];
    currentInput = samples["customer email"];
    updateOutput();
  } else {
    alert("Sample customer email not found.");
  }
});

document.getElementById('sampleDocumentButton').addEventListener('click', () => {
  if (samples["document"]) {
    inputText.value = samples["document"];
    currentInput = samples["document"];
    updateOutput();
  } else {
    alert("Sample document not found.");
  }
});

// Initialize the application
async function init() {
  statusElement.textContent = 'Loading model and samples...';
  try {
    await loadModel();
    await loadSamples();
    statusElement.textContent = 'Model and samples loaded';
    updateOutput();
  } catch (err) {
    statusElement.textContent = 'Error loading model or samples';
    outputText.value = "Error loading model or samples.";
  }
}

init();