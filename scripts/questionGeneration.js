const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "gsk_yy8xbTlJISG7MB5rtNWGdyb3FYMoamQEG41U6CbrGvthgU0N61"; // Use your valid API key

let logs = [];

function logMessage(message) {
  logs.push(message);
  console.log(message);
  updateLogDisplay();
}

function updateLogDisplay() {
  document.getElementById("logContent").innerText = logs.join("\n");
}

document.addEventListener("DOMContentLoaded", function () {
  const outputImage = document.getElementById("outputImage");
  const questionFrame = document.getElementById("questionFrame");
  const generatedQuestion = document.getElementById("generatedQuestion");

  // Attach event listener to the Generate Question button
  document.getElementById("generateQuestionBtn").addEventListener("click", async function () {
    if (!outputImage.src) {
      alert("Please preview an image before generating a question.");
      return;
    }
    
    // Step 1: Perform OCR on the previewed image
    logMessage("Starting OCR on the previewed image...");
    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    logMessage("Extracting text from previewed image...");
    const { data: { text } } = await worker.recognize(outputImage);
    await worker.terminate();
    logMessage(`Extracted Text:\n${text}`);
    
    if (!text.trim()) {
      alert("No text detected. Please use a clearer image.");
      return;
    }
    
    // Step 2: Crop the image using the cropCurrentImage() function from cropping.js
    logMessage("Cropping image using detected options...");
    const croppedImageData = await cropCurrentImage();
    if (!croppedImageData) {
      alert("Failed to crop the image.");
      return;
    }
    
    // Step 3: Send the extracted text to Groq API for question generation
    logMessage("Sending extracted text to Groq API...");
    const formattedQuestion = await generateQuestionFromText(text);
    if (!formattedQuestion) {
      alert("Failed to generate question.");
      return;
    }
    
    // Step 4: Display the final output (cropped image + generated question)
    displayFormattedQuestion(croppedImageData, formattedQuestion);
  });

  async function generateQuestionFromText(text) {
    logMessage("Calling Groq API for question generation...");
    const requestData = {
      model: "mixtral-8x7b-32768",
      messages: [
        {
          role: "system",
          content: "Extract and format the given text into a structured question format:\n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:"
        },
        { role: "user", content: text }
      ],
      max_tokens: 300
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestData)
      });
      logMessage("Groq API request sent. Waiting for response...");
      const result = await response.json();
      if (result.choices && result.choices.length > 0) {
        const formattedQuestion = result.choices[0].message.content;
        logMessage(`Generated Question:\n${formattedQuestion}`);
        return formattedQuestion;
      } else {
        logMessage("Error: Failed to generate question.");
        return null;
      }
    } catch (error) {
      console.error("Error fetching from Groq API:", error.message);
      logMessage(`API Error: ${error.message}`);
      return null;
    }
  }

  function displayFormattedQuestion(imageSrc, questionData) {
    questionFrame.style.display = "block";
    let formattedOutput = `
      <img src="${imageSrc}" style="max-width: 100%; border: 1px solid black; margin-bottom: 10px;">
      <p><strong>Generated Question:</strong></p>
      <pre>${questionData}</pre>
    `;
    generatedQuestion.innerHTML = formattedOutput;
  }

  // Expose log functions globally for the modal
  window.showLogs = function () {
    document.getElementById("logModal").style.display = "block";
  };
  window.closeLogModal = function () {
    document.getElementById("logModal").style.display = "none";
  };
});
