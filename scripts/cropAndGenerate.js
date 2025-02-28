document.getElementById("generateQuestionBtn").addEventListener("click", async function() {
    logMessage("Starting process to generate MCQ...");
    
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to process!");
        logMessage("Error: No image available.");
        return;
    }
    
    logMessage("Cropped image ready.");
    
    const img = new Image();
    img.src = outputImage.src;
    
    img.onload = async () => {
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const worker = Tesseract.createWorker();
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
        
        logMessage("Extracting text from cropped image...");
        
        const { data: { words } } = await worker.recognize(img);
        await worker.terminate();
        
        const optionsStartY = detectOptionsStart(words);
        if (optionsStartY === null) {
            alert("No options detected.");
            logMessage("Error: No options detected.");
            return;
        }
        
        const croppedCanvas = document.createElement("canvas");
        const croppedCtx = croppedCanvas.getContext("2d");
        croppedCanvas.width = canvas.width;
        croppedCanvas.height = optionsStartY;
        
        croppedCtx.drawImage(canvas, 0, 0, canvas.width, optionsStartY, 0, 0, canvas.width, optionsStartY);
        
        const croppedImageSrc = croppedCanvas.toDataURL("image/png");
        
        logMessage("Extracting text from cropped section...");
        
        const { data: { text } } = await Tesseract.recognize(croppedImageSrc, "eng");
        
        logMessage("Extracted Text: \n" + text);
        
        if (!text.trim()) {
            alert("No text detected. Please use a clearer image.");
            logMessage("Error: No text detected.");
            return;
        }
        
        logMessage("Generating MCQ using Groq API...");
        
        const requestData = {
            model: "mixtral-8x7b-32768",
            messages: [
                { role: "system", content: "Extract and format the given text into a structured question format: \n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:" },
                { role: "user", content: text }
            ],
            max_tokens: 300
        };
        
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer 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`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            });
        
            logMessage("Groq API request sent. Waiting for response...");
            
            const result = await response.json();
            
            if (result.choices && result.choices.length > 0) {
                const formattedQuestion = result.choices[0].message.content;
                
                document.getElementById("questionFrame").style.display = "block";
                document.getElementById("generatedQuestion").innerHTML = `<img src="${croppedImageSrc}" style="max-width: 100%;"><br><br>${formattedQuestion}`;
                
                logMessage("MCQ successfully generated and displayed.");
            } else {
                alert("Failed to generate the question.");
                logMessage("Error: Failed to generate the question.");
            }
        } catch (error) {
            console.error("Error fetching from Groq API:", error.message);
            alert(`An error occurred: ${error.message}`);
            logMessage(`API Error: ${error.message}`);
        }
    };
});

function detectOptionsStart(words) {
    for (let i = 0; i < words.length; i++) {
        if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
            return words[i].bbox.y0;
        }
    }
    return null;
}
