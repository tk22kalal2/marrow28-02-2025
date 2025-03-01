// This file handles the integration between cropping and question generation

// Function to handle the generate question button click
function handleGenerateQuestion() {
    logMessage("Generate Question button clicked");
    
    // Get the current image
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to process!");
        logMessage("Error: No image displayed for question generation.");
        return;
    }

    // Create a container for the cropped question
    const croppedQuestionContainer = document.getElementById("croppedQuestionContainer");
    croppedQuestionContainer.style.display = "block";
    
    // First crop the image to get just the question part
    const img = new Image();
    img.src = outputImage.src;

    img.onload = async () => {
        logMessage("Processing image for question generation...");
        
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Use Tesseract to detect text and find options
        const worker = Tesseract.createWorker();
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");

        const { data: { words, text } } = await worker.recognize(img);
        await worker.terminate();

        logMessage("Text detected, looking for options...");
        
        // Find where options start
        const optionsStartY = detectOptionsStart(words);
        if (optionsStartY === null) {
            logMessage("No options detected, processing full image as question.");
            // If no options detected, use the full image
            createMCQFromText(text, img);
        } else {
            // Crop the image to get just the question part
            logMessage("Options detected, cropping image...");
            
            // Create a cropped version showing just the question
            const croppedCanvas = document.createElement("canvas");
            const croppedCtx = croppedCanvas.getContext("2d");
            croppedCanvas.width = canvas.width;
            croppedCanvas.height = optionsStartY;

            croppedCtx.drawImage(canvas, 0, 0, canvas.width, optionsStartY, 0, 0, canvas.width, optionsStartY);

            // Display the cropped question
            const croppedOutput = document.getElementById("croppedOutput");
            croppedOutput.innerHTML = "";
            
            const croppedImage = new Image();
            croppedImage.src = croppedCanvas.toDataURL("image/png");
            croppedOutput.appendChild(croppedImage);
            
            // Process the full text for question generation
            createMCQFromText(text, croppedImage);
        }
    };
}

// Function to create MCQ from the extracted text
async function createMCQFromText(text, questionImage) {
    logMessage("Creating MCQ from extracted text...");
    
    try {
        // Get formatted question from Groq API
        const formattedQuestion = await getFormattedQuestionData(text);
        
        if (!formattedQuestion) {
            logMessage("Failed to generate formatted question data.");
            return;
        }
        
        // Parse the formatted question to extract options, correct answer, and explanation
        const questionData = parseFormattedQuestion(formattedQuestion);
        
        if (!questionData) {
            logMessage("Failed to parse question data.");
            return;
        }
        
        // Display the MCQ with the question image and options
        displayMCQ(questionImage, questionData);
        
    } catch (error) {
        logMessage(`Error creating MCQ: ${error.message}`);
        console.error("Error creating MCQ:", error);
    }
}

// Function to get formatted question data from Groq API
async function getFormattedQuestionData(text) {
    logMessage("Getting formatted question data from Groq API...");
    
    const requestData = {
        model: "mixtral-8x7b-32768",
        messages: [
            { role: "system", content: "Extract and format the given text into a structured question format: \n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:" },
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
            logMessage(`Generated Question Data:\n${formattedQuestion}`);
            return formattedQuestion;
        } else {
            alert("Failed to generate the question.");
            logMessage("Error: Failed to generate the question.");
            return null;
        }
    } catch (error) {
        console.error("Error fetching from Groq API:", error.message);
        alert(`An error occurred: ${error.message}`);
        logMessage(`API Error: ${error.message}`);
        return null;
    }
}

// Function to parse the formatted question
function parseFormattedQuestion(formattedText) {
    logMessage("Parsing formatted question...");
    
    try {
        // Initialize the question data object
        const questionData = {
            options: {},
            correctAnswer: '',
            explanation: ''
        };
        
        // Extract options (A, B, C, D)
        const optionRegex = /([A-D])\)\s*(.*?)(?=\n[A-D]\)|$|\nCorrect Answer:)/gs;
        let optionMatch;
        
        while ((optionMatch = optionRegex.exec(formattedText)) !== null) {
            const optionLetter = optionMatch[1];
            const optionText = optionMatch[2].trim();
            questionData.options[optionLetter] = optionText;
        }
        
        // Extract correct answer
        const correctAnswerRegex = /Correct Answer:\s*([A-D])/i;
        const correctAnswerMatch = formattedText.match(correctAnswerRegex);
        
        if (correctAnswerMatch) {
            questionData.correctAnswer = correctAnswerMatch[1];
        }
        
        // Extract explanation
        const explanationRegex = /Explanation:\s*([\s\S]*?)$/i;
        const explanationMatch = formattedText.match(explanationRegex);
        
        if (explanationMatch) {
            questionData.explanation = explanationMatch[1].trim();
        }
        
        logMessage(`Parsed question data: ${JSON.stringify(questionData)}`);
        return questionData;
        
    } catch (error) {
        logMessage(`Error parsing question: ${error.message}`);
        console.error("Error parsing question:", error);
        return null;
    }
}

// Function to display the MCQ
function displayMCQ(questionImage, questionData) {
    logMessage("Displaying MCQ...");
    
    // Get the question frame element
    const questionFrame = document.getElementById("questionFrame");
    questionFrame.style.display = "block";
    
    // Clear previous content
    questionFrame.innerHTML = "";
    
    // Create container for the question
    const questionContainer = document.createElement("div");
    questionContainer.className = "question-container";
    
    // Add the question image
    const imgElement = document.createElement("img");
    imgElement.src = questionImage.src || questionImage;
    imgElement.style.maxWidth = "100%";
    imgElement.style.marginBottom = "20px";
    questionContainer.appendChild(imgElement);
    
    // Create options container
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "options-container";
    optionsContainer.style.marginTop = "20px";
    
    // Add options
    for (const [optionLetter, optionText] of Object.entries(questionData.options)) {
        const optionButton = document.createElement("button");
        optionButton.className = "option-button";
        optionButton.textContent = `${optionLetter}) ${optionText}`;
        optionButton.style.display = "block";
        optionButton.style.width = "100%";
        optionButton.style.textAlign = "left";
        optionButton.style.margin = "10px 0";
        optionButton.style.padding = "10px";
        optionButton.style.border = "1px solid #ccc";
        optionButton.style.borderRadius = "5px";
        optionButton.style.cursor = "pointer";
        
        // Add click event to check answer
        optionButton.addEventListener("click", function() {
            // Reset all buttons
            document.querySelectorAll(".option-button").forEach(btn => {
                btn.style.backgroundColor = "";
                btn.style.color = "";
            });
            
            // Check if correct
            if (optionLetter === questionData.correctAnswer) {
                optionButton.style.backgroundColor = "#4CAF50"; // Green
                optionButton.style.color = "white";
                logMessage(`Correct answer selected: ${optionLetter}`);
            } else {
                optionButton.style.backgroundColor = "#F44336"; // Red
                optionButton.style.color = "white";
                
                // Highlight correct answer
                document.querySelectorAll(".option-button").forEach(btn => {
                    if (btn.textContent.startsWith(`${questionData.correctAnswer})`)) {
                        btn.style.backgroundColor = "#4CAF50"; // Green
                        btn.style.color = "white";
                    }
                });
                
                logMessage(`Incorrect answer selected: ${optionLetter}. Correct answer: ${questionData.correctAnswer}`);
            }
            
            // Show explanation
            showExplanation(questionData.explanation, questionData.correctAnswer);
        });
        
        optionsContainer.appendChild(optionButton);
    }
    
    // Add options to question container
    questionContainer.appendChild(optionsContainer);
    
    // Create explanation container (hidden initially)
    const explanationContainer = document.createElement("div");
    explanationContainer.id = "explanation-container";
    explanationContainer.style.display = "none";
    explanationContainer.style.marginTop = "20px";
    explanationContainer.style.padding = "15px";
    explanationContainer.style.backgroundColor = "#f9f9f9";
    explanationContainer.style.border = "1px solid #ddd";
    explanationContainer.style.borderRadius = "5px";
    
    // Add explanation container to question container
    questionContainer.appendChild(explanationContainer);
    
    // Add the question container to the question frame
    questionFrame.appendChild(questionContainer);
    
    logMessage("MCQ displayed successfully.");
}

// Function to show explanation
function showExplanation(explanation, correctAnswer) {
    const explanationContainer = document.getElementById("explanation-container");
    
    if (!explanationContainer) {
        logMessage("Explanation container not found.");
        return;
    }
    
    explanationContainer.style.display = "block";
    explanationContainer.innerHTML = `
        <h4>Correct Answer: ${correctAnswer}</h4>
        <h4>Explanation:</h4>
        <p>${explanation}</p>
    `;
    
    logMessage("Explanation displayed.");
}

// Add event listener when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded in cropAndGenerate.js');
    const generateBtn = document.getElementById("generateQuestionBtn");
    if (generateBtn) {
        generateBtn.addEventListener("click", handleGenerateQuestion);
        console.log('Generate button event listener attached');
    } else {
        console.error('Generate button not found in cropAndGenerate.js');
    }
});
