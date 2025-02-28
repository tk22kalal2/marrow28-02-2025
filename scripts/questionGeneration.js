const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";

let logs = [];

function logMessage(message) {
    logs.push(message);
    console.log(message);
    updateLogDisplay();
}

function updateLogDisplay() {
    document.getElementById("logContent").innerText = logs.join("\n");
}

async function makeQuestion() {
    logMessage("Starting text extraction...");

    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to extract text!");
        logMessage("Error: No image displayed.");
        return;
    }

    logMessage("Image detected. Initializing OCR...");

    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    logMessage("Tesseract initialized. Extracting text...");
    
    const { data: { text } } = await worker.recognize(outputImage);
    await worker.terminate();

    logMessage(`Extracted Text: \n${text}`);

    if (!text.trim()) {
        alert("No text detected. Please use a clearer image.");
        logMessage("Error: No text detected.");
        return;
    }

    // Get the cropped image URL from cropping.js
    const croppedCanvas = document.getElementById("canvas");
    const croppedImageURL = croppedCanvas.toDataURL("image/png");

    getFormattedQuestion(text, croppedImageURL);
}

async function getFormattedQuestion(text, croppedImageURL) {
    logMessage("Sending extracted text to Groq API...");

    const requestData = {
        model: "mixtral-8x7b-32768",
        messages: [
            { role: "system", content: "Extract and format the given text into a structured question format as follows:\n\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:" },
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
            
            // Show cropped image
            document.getElementById("croppedQuestionImage").src = croppedImageURL;
            document.getElementById("croppedImageFrame").style.display = "block";

            // Show formatted text
            document.getElementById("generatedQuestion").innerText = formattedQuestion;
            document.getElementById("questionFrame").style.display = "block";

            logMessage(`Generated Question:\n${formattedQuestion}`);
        } else {
            alert("Failed to generate the question.");
            logMessage("Error: Failed to generate the question.");
        }
    } catch (error) {
        console.error("Error fetching from Groq API:", error.message);
        alert(`An error occurred: ${error.message}`);
        logMessage(`API Error: ${error.message}`);
    }
}

// Function to show logs in a pop-up
function showLogs() {
    document.getElementById("logModal").style.display = "block";
}

// Function to close the log modal
function closeLogModal() {
    document.getElementById("logModal").style.display = "none";
}
