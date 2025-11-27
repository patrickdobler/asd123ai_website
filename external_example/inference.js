import { AutoModel, AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0';

let tokenizer, model;
let isModelLoaded = false;

async function loadModel() {
  try {
    tokenizer = await AutoTokenizer.from_pretrained('ai4privacy/llama-ai4privacy-english-anonymiser-openpii');
    model = await AutoModel.from_pretrained('ai4privacy/llama-ai4privacy-english-anonymiser-openpii', { dtype: "q8" });
    isModelLoaded = true;
  } catch (err) {
    console.error("Error loading model:", err);
    isModelLoaded = false;
    throw err;
  }
}

async function processText(text, threshold = 0.3) {
  if (!isModelLoaded) {
    throw new Error('Model not loaded');
  }
  const inputs = await tokenizer(text);
  const inputTokens = inputs.input_ids.data;
  const tokenStrings = Array.from(inputTokens).map(id => 
    tokenizer.decode([id], { skip_special_tokens: false })
  );

  const { logits } = await model(inputs);
  const logitsData = Array.from(logits.data);
  const numTokens = tokenStrings.length;
  const numClasses = 3;

  const logitsPerToken = [];
  for (let i = 0; i < numTokens; i++) {
    logitsPerToken.push(logitsData.slice(i * numClasses, (i + 1) * numClasses));
  }

  function softmax(logits) {
    const expLogits = logits.map(Math.exp);
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    return expLogits.map(exp => exp / sumExp);
  }

  const tokenPredictions = tokenStrings.map((token, i) => {
    const probs = softmax(logitsPerToken[i]);
    const maxSensitive = Math.max(probs[0], probs[1]);
    return {
      token: token,
      start: i,
      end: i + 1,
      probabilities: {
        "B-PRIVATE": probs[0],
        "I-PRIVATE": probs[1],
        "O": probs[2]
      },
      maxSensitiveScore: maxSensitive
    };
  });

  const aggregated = aggregatePrivacyTokens(tokenPredictions, threshold);
  const { maskedText, replacements } = maskText(tokenPredictions, aggregated);
  return { maskedText, replacements };
}

function aggregatePrivacyTokens(tokenPredictions, threshold) {
  const aggregated = [];
  let i = 0;
  const n = tokenPredictions.length;
  
  while (i < n) {
    const currentToken = tokenPredictions[i];
    if (['[CLS]', '[SEP]'].includes(currentToken.token)) {
      i++;
      continue;
    }
    const startsWithSpace = currentToken.token.startsWith(' ');
    const isFirstWord = aggregated.length === 0 && i === 0;
    if (startsWithSpace || isFirstWord) {
      const group = {
        tokens: [currentToken],
        indices: [i],
        scores: [currentToken.maxSensitiveScore],
        startsWithSpace: startsWithSpace
      };
      i++;
      while (i < n && 
            !tokenPredictions[i].token.startsWith(' ') && 
            !['[CLS]', '[SEP]'].includes(tokenPredictions[i].token)) {
        group.tokens.push(tokenPredictions[i]);
        group.indices.push(i);
        group.scores.push(tokenPredictions[i].maxSensitiveScore);
        i++;
      }
      if (Math.max(...group.scores) >= threshold) {
        aggregated.push(group);
      }
    } else {
      i++;
    }
  }
  return aggregated;
}

function maskText(tokenPredictions, aggregatedGroups) {
    const maskedTokens = [];
    const replacements = [];
    const maskedIndices = new Set();
    let redactedCounter = 1;
    
    aggregatedGroups.forEach(group => {
      group.indices.forEach(idx => maskedIndices.add(idx));
    });
  
    tokenPredictions.forEach((token, idx) => {
      if (['[CLS]', '[SEP]'].includes(token.token)) return;
      if (maskedIndices.has(idx)) {
        const group = aggregatedGroups.find(g => g.indices[0] === idx);
        if (group) {
          const originalTokens = group.tokens.map(t => t.token);
          const originalText = originalTokens
            .map((token, i) => (i === 0 && group.startsWithSpace ? token.trimStart() : token))
            .join('');
          const placeholder = `[PII_${redactedCounter}]`;
          replacements.push({ 
            original: originalText, 
            placeholder: placeholder,
            activation: Math.max(...group.scores)
          });
          redactedCounter++;
          const maskWithSpace = group.startsWithSpace ? ` ${placeholder}` : placeholder;
          maskedTokens.push(maskWithSpace);
        }
      } else {
        maskedTokens.push(token.token);
      }
    });
  
    // First join the tokens, then split into lines.
    const joinedText = maskedTokens.join('');
    // For each line, collapse only spaces and tabs.
    const processedLines = joinedText.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim());
    const maskedText = processedLines.join('\n').trim();
    
    return { maskedText, replacements };
  }
    

export { loadModel, processText, isModelLoaded };