const uploadImage = document.getElementById("uploadImage");
const processButton = document.getElementById("processButton");
const cropButton = document.getElementById("cropButton");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");
let uploadedImage = null;

// Handle image upload
uploadImage.addEventListener("change", (event) => {
  alert("Uploading image...");

  const file = event.target.files[0];
  if (!file) {
    alert("No file selected. Please upload an image.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;

    img.onload = () => {
      alert("Image uploaded successfully! Rendering on canvas...");
      uploadedImage = img;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      processButton.disabled = false;
    };
  };

  reader.readAsDataURL(file);
});

// Handle process image
processButton.addEventListener("click", async () => {
  if (!uploadedImage) {
    alert("No image uploaded yet. Please upload an image first.");
    return;
  }

  try {
    alert("Starting OCR process...");
    const worker = Tesseract.createWorker();

    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    alert("OCR initialized successfully! Reading image text...");

    const { data: { words } } = await worker.recognize(uploadedImage);

    if (!words || words.length === 0) {
      alert("No text detected. Ensure the image contains readable text.");
      return;
    }

    alert("Detecting options and question...");

    const optionsStartY = detectOptionsStart(words);
    if (optionsStartY === null) {
      alert("No options detected. Check format.");
      return;
    }

    const questionEndY = detectQuestionEnd(words, optionsStartY);
    if (questionEndY === null) {
      alert("No question end detected. Check format.");
      return;
    }

    cropButton.dataset.startY = questionEndY;
    cropButton.dataset.endY = optionsStartY;
    cropButton.disabled = false;
    alert("Processing completed! Click 'Crop' to crop the image.");

    await worker.terminate();
  } catch (error) {
    alert("Error processing image. Check console.");
    console.error(error);
  }
});

// Handle cropping
cropButton.addEventListener("click", () => {
  const startY = parseInt(cropButton.dataset.startY);
  const endY = parseInt(cropButton.dataset.endY);
  performCropping(startY, endY);
});

function performCropping(startY, endY) {
  const cropHeight = endY - startY;
  if (cropHeight <= 0) {
    alert("Invalid cropping height.");
    return;
  }

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");
  croppedCanvas.width = canvas.width;
  croppedCanvas.height = cropHeight;

  croppedCtx.drawImage(
    uploadedImage,
    0, startY, canvas.width, cropHeight,
    0, 0, canvas.width, cropHeight
  );

  const croppedImage = new Image();
  croppedImage.src = croppedCanvas.toDataURL("image/png");
  output.appendChild(croppedImage);
  alert("Image cropped successfully!");
}

function detectOptionsStart(words) {
  console.log("Detecting options start...");
  for (let i = 0; i < words.length; i++) {
    if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
      console.log("Options start detected at Y-coordinate:", words[i].bbox.y0);
      return words[i].bbox.y0;
    }
  }
  console.warn("No options start detected.");
  return null;
}

function detectQuestionEnd(words, optionsStartY) {
  console.log("Detecting question end...");
  let lastTextY = 0;
  let largeGapDetected = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const currentY = word.bbox.y1;

    if (currentY >= optionsStartY) break;

    if (lastTextY > 0 && (currentY - lastTextY) > 20) {
      largeGapDetected = true;
      console.log("Large vertical gap detected, assuming question end at Y:", lastTextY);
      break;
    }

    lastTextY = currentY;
  }

  if (largeGapDetected) {
    return lastTextY;
  }

  console.warn("No clear question end detected.");
  return lastTextY;
}
