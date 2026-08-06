// --- DRAW RUN - メインゲームスクリプト（新・巨大壁ギミック統合版） ---

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 700;

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

const engine = Engine.create();
const world = engine.world;

engine.world.gravity.y = 0.7;

// --- 画像の読み込み ---
const groundImage = new Image();
groundImage.src = "ground.jpg";

const backgroundImage = new Image();
backgroundImage.src = "haikei-aozora.png";

const spikeImage = new Image();
spikeImage.src = "spike.png"; 

// --- 音声ファイルの読み込みと音量設定 ---
const deathSound = new Audio("death.mp3");
deathSound.volume = 0.03;
const playBGM = new Audio("play.mp3");
playBGM.loop = true; 
playBGM.volume = 0.03; 

const characterList = [
  { src: "player.png", name: "棒人間" },
  { src: "player2.png", name: "格闘家" }, 
  { src: "player3.png", name: "忍者" }    
];

const playerImages = characterList.map((char) => {
  const img = new Image();
  img.src = char.src;
  return img;
});

let currentSkinIndex = parseInt(localStorage.getItem('drawRunSkinIndex')) || 0;
if (currentSkinIndex < 0 || currentSkinIndex >= characterList.length) {
  currentSkinIndex = 0;
}

let gameStarted = false;
let gameOver = false;

const playerSize = 20;
const player = Bodies.circle(200, canvas.height / 2, playerSize, {
  friction: 0.05,
  restitution: 0,
  inertia: Infinity
});
World.add(world, player);

let score = 0; 
let cameraX = 0;

const basePlayerSpeed = 4;
let playerSpeed = basePlayerSpeed;
let stoppedTime = 0;

const baseHoleSize = 400;
const maxDrawLength = baseHoleSize * 1.5; 

const cooldownDuration = 500; 
let lastReleaseTime = 0;      
const minSafeDistance = 400; 

function saveScore(newScore) {
  const now = new Date();
  const dateString = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let scores = JSON.parse(localStorage.getItem('drawRunScores')) || [];
  scores.push({ score: newScore, date: dateString });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 5); 
  localStorage.setItem('drawRunScores', JSON.stringify(scores));

  const lastRecord = { score: newScore, date: dateString };
  localStorage.setItem('drawRunLastScore', JSON.stringify(lastRecord));
}

function getGravityState(currentScore) {
  if (currentScore >= 90 && currentScore <= 200) {
    return true; 
  } else if (currentScore > 200) {
    let distanceAfter200 = currentScore - 200;
    let remainder = distanceAfter200 % 150;
    if (remainder <= 50) {
      return true;
    }
  }
  return false;
}

const grounds = [];
const ceilings = []; 
const walls = [];
const spikes = []; 
const fakeGrounds = []; 
const popupSpikes = []; 

let currentX = 0;
const segmentWidth = 400; 
let lastObstacleX = 0;

function generateSegment() {
  const currentGroundY = canvas.height - 40;
  const groundHeight = 80;

  const currentCeilingY = 40; 
  const currentWallY = currentGroundY - 100; 
  const currentSpikeY = canvas.height * 0.25;

  if (currentX <= 1200) {
    const ground = Bodies.rectangle(
      currentX + segmentWidth / 2,
      currentGroundY,
      segmentWidth,
      groundHeight,
      { isStatic: true, label: "ground" }
    );
    grounds.push(ground);
    World.add(world, ground);
    currentX += segmentWidth;
    return;
  }

  const distanceSinceLastObstacle = currentX - lastObstacleX;
  const isSafeZoneOver = distanceSinceLastObstacle >= minSafeDistance;

  if (!isSafeZoneOver) {
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true });
    grounds.push(ground);
    World.add(world, ground);
    
    const genScore = Math.floor((currentX - 200) / 100);
    if (getGravityState(genScore)) {
      const ceiling = Bodies.rectangle(currentX + segmentWidth / 2, currentCeilingY, segmentWidth, groundHeight, { isStatic: true });
      ceilings.push(ceiling);
      World.add(world, ceiling);
    }

    currentX += segmentWidth;
    return;
  }

  // 障害物の抽選（穴、通常壁/新巨大壁、トゲ、飛び出しトゲ）
  const rand = Math.random();

  if (rand < 0.20) {
    // --- ① 穴ギミック ---
    const maxSafeHoleSize = maxDrawLength * 0.8; 
    const holeWidth = 200 + Math.random() * (maxSafeHoleSize - 200);
    const leftWidth = 100;
    const leftGround = Bodies.rectangle(currentX + leftWidth / 2, currentGroundY, leftWidth, groundHeight, { isStatic: true });
    grounds.push(leftGround);
    World.add(world, leftGround);

    const genScoreF = Math.floor((currentX - 200) / 100);
    if (genScoreF >= 50 && Math.random() < 0.5) {
        const fakeHoleFloor = Bodies.rectangle(
            currentX + leftWidth + holeWidth / 2, 
            currentGroundY, 
            holeWidth, 
            groundHeight, 
            { isStatic: true, isSensor: true, label: "fakeFloor" }
        );
        fakeGrounds.push(fakeHoleFloor);
        World.add(world, fakeHoleFloor);
    }

    const genScore1 = Math.floor((currentX - 200) / 100);
    if (getGravityState(genScore1)) {
      const ceiling = Bodies.rectangle(currentX + leftWidth / 2, currentCeilingY, leftWidth, groundHeight, { isStatic: true });
      ceilings.push(ceiling); World.add(world, ceiling);
    }

    currentX += leftWidth + holeWidth;
    const rightWidth = 150;
    const rightGround = Bodies.rectangle(currentX + rightWidth / 2, currentGroundY, rightWidth, groundHeight, { isStatic: true });
    grounds.push(rightGround);
    World.add(world, rightGround);

    const genScore2 = Math.floor((currentX - 200) / 100);
    if (getGravityState(genScore2)) {
      const ceiling = Bodies.rectangle(currentX + rightWidth / 2, currentCeilingY, rightWidth, groundHeight, { isStatic: true });
      ceilings.push(ceiling); World.add(world, ceiling);
    }

    currentX += rightWidth;
    lastObstacleX = currentX;

  } else if (rand < 0.45) {
    // --- ② 通常壁 or 新ギミック：プレイヤーの2倍サイズの穴が開いた巨大壁 ---
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true });
    grounds.push(ground);
    World.add(world, ground);

    const checkScore = Math.floor((currentX - 200) / 100);
    if (checkScore >= 85 && checkScore <= 95) {
      // セーフティ
    } else {
      // 50%の確率で「通常の壁」か「新・巨大壁（穴あき）」に分岐
      if (Math.random() < 0.5) {
        // 通常の壁
        const wall = Bodies.rectangle(currentX + segmentWidth / 2, currentWallY, 40, 200, { isStatic: true });
        walls.push(wall);
        World.add(world, wall);
      } else {
        // 新・巨大壁（中央にプレイヤー直径の2倍の穴）
        const obstacleX = currentX + segmentWidth / 2;
        const wallWidth = 50; 
        const totalHeight = currentGroundY; 
        const holeSize = playerSize * 2 * 2; // キャラ直径の2倍

        const minHoleCenter = holeSize / 2 + 50; 
        const maxHoleCenter = totalHeight - holeSize / 2 - 100;
        const holeCenterY = minHoleCenter + Math.random() * (maxHoleCenter - minHoleCenter);

        const upperWallHeight = holeCenterY - holeSize / 2;
        if (upperWallHeight > 0) {
          const upperWall = Bodies.rectangle(obstacleX, upperWallHeight / 2, wallWidth, upperWallHeight, { isStatic: true });
          walls.push(upperWall);
          World.add(world, upperWall);
        }

        const lowerWallHeight = totalHeight - (holeCenterY + holeSize / 2);
        if (lowerWallHeight > 0) {
          const lowerWallY = (holeCenterY + holeSize / 2) + lowerWallHeight / 2;
          const lowerWall = Bodies.rectangle(obstacleX, lowerWallY, wallWidth, lowerWallHeight, { isStatic: true });
          walls.push(lowerWall);
          World.add(world, lowerWall);
        }
      }
    }

    const genScore = Math.floor((currentX - 200) / 100);
    if (getGravityState(genScore)) {
      const ceiling = Bodies.rectangle(currentX + segmentWidth / 2, currentCeilingY, segmentWidth, groundHeight, { isStatic: true });
      ceilings.push(ceiling); World.add(world, ceiling);
    }

    currentX += segmentWidth;
    lastObstacleX = currentX;

  } else if (rand < 0.70) {
    // --- ③ 上から降ってくるトゲギミック ---
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true });
    grounds.push(ground);
    World.add(world, ground);

    const spikeParts = [];
    const targetX = currentX + segmentWidth / 2;

    const genScore = Math.floor((currentX - 200) / 100);
    let finalSpikeY = currentSpikeY; 

    if (getGravityState(genScore)) {
      finalSpikeY = 500; 
    }

    for (let i = 0; i < 5; i++) {
      const part = Bodies.polygon(targetX - 80 + i * 40, finalSpikeY, 3, 25, { friction: 0.1, restitution: 0.1 });
      spikeParts.push(part);
    }
    const combinedSpike = Body.create({ parts: spikeParts, isStatic: true, label: "spike" });
    Body.setPosition(combinedSpike, { x: targetX, y: finalSpikeY });
    combinedSpike.isTriggered = false;
    spikes.push(combinedSpike);
    World.add(world, combinedSpike);

    if (getGravityState(genScore)) {
      const ceiling = Bodies.rectangle(currentX + segmentWidth / 2, currentCeilingY, segmentWidth, groundHeight, { isStatic: true });
      ceilings.push(ceiling); World.add(world, ceiling);
    }

    currentX += segmentWidth;
    lastObstacleX = currentX;

  } else {
    // --- ④ 飛び出しトゲギミック ---
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true });
    grounds.push(ground);
    World.add(world, ground);

    const genScoreP = Math.floor((currentX - 200) / 100);
    if (!getGravityState(genScoreP) && Math.random() < 0.25) { 
      const spikeParts = [];
      const targetX = currentX + segmentWidth / 2;
      const hiddenY = currentGroundY - (groundHeight / 2) + 5; 

      for (let i = 0; i < 3; i++) {
        const pX = targetX - 40 + i * 40;
        const part = Bodies.polygon(pX, hiddenY, 3, 23, { friction: 0.1, restitution: 0.1 });
        spikeParts.push(part);
      }
      
      const popupSpike = Body.create({ parts: spikeParts, isStatic: true, label: "popupSpike" });
      Body.setPosition(popupSpike, { x: targetX, y: hiddenY });
      popupSpike.isTriggered = false; 
      
      popupSpikes.push(popupSpike);
      World.add(world, popupSpike);
    }

    const genScore = Math.floor((currentX - 200) / 100);
    if (getGravityState(genScore)) {
      const ceiling = Bodies.rectangle(currentX + segmentWidth / 2, currentCeilingY, segmentWidth, groundHeight, { isStatic: true });
      ceilings.push(ceiling); World.add(world, ceiling);
    }

    currentX += segmentWidth;
  }
}

for (let i = 0; i < 15; i++) {
  generateSegment();
}

let drawing = false;
let lastPoint = null;
const currentLines = [];
let currentDrawLength = 0;
const maxDrawTime = 3000;
let drawStartTime = 0;

function releaseLines() {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
  lastReleaseTime = Date.now();

  currentLines.forEach((line) => {
    Body.setStatic(line, false);
    setTimeout(() => { World.remove(world, line); }, 500);
  });
  currentLines.length = 0;
}

function getCanvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(clientX, clientY) {
  if (!gameStarted) return;
  if (gameOver) return;

  const timeSinceLastRelease = Date.now() - lastReleaseTime;
  if (timeSinceLastRelease < cooldownDuration) return; 

  const pt = getCanvasPoint(clientX, clientY);

  drawing = true;
  currentDrawLength = 0;
  drawStartTime = Date.now();
  lastPoint = { x: pt.x + cameraX, y: pt.y };
}

function moveDrawing(clientX, clientY) {
  if (!drawing) return;

  const elapsedTime = Date.now() - drawStartTime;
  if (elapsedTime >= maxDrawTime) {
    releaseLines();
    return;
  }

  const pt = getCanvasPoint(clientX, clientY);
  const currentPoint = { x: pt.x + cameraX, y: pt.y };
  const dx = currentPoint.x - lastPoint.x;
  const dy = currentPoint.y - lastPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (currentDrawLength + length > maxDrawLength) return;

  currentDrawLength += length;
  const angle = Math.atan2(dy, dx);

  const line = Bodies.rectangle(
    (lastPoint.x + currentPoint.x) / 2,
    (lastPoint.y + currentPoint.y) / 2,
    length,
    12,
    { isStatic: true, angle: angle, friction: 0.8, density: 0.002 }
  );

  currentLines.push(line);
  World.add(world, line);
  lastPoint = currentPoint;
}

function handleScreenClick(clientX, clientY) {
  if (gameOver) {
    const pt = getCanvasPoint(clientX, clientY);
    
    const btnX = canvas.width / 2 - 100;
    const btnY = canvas.height / 2 + 65;
    const btnW = 200;
    const btnH = 45;

    if (pt.x >= btnX && pt.x <= btnX + btnW && pt.y >= btnY && pt.y <= btnY + btnH) {
      playBGM.pause(); 
      location.reload(); 
    }
  }
}

canvas.addEventListener("mousedown", (e) => {
  if (gameOver) {
    handleScreenClick(e.clientX, e.clientY);
  } else {
    startDrawing(e.clientX, e.clientY);
  }
});
canvas.addEventListener("mousemove", (e) => moveDrawing(e.clientX, e.clientY));
canvas.addEventListener("mouseup", () => releaseLines());

canvas.addEventListener("touchstart", (e) => {
  if (gameOver) {
    e.preventDefault();
    const touch = e.touches[0];
    handleScreenClick(touch.clientX, touch.clientY);
  } else {
    e.preventDefault();
    const touch = e.touches[0];
    startDrawing(touch.clientX, touch.clientY);
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  moveDrawing(touch.clientX, touch.clientY);
});
canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  releaseLines();
});

Matter.Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach((pair) => {
    walls.forEach((wall) => {
      if ((pair.bodyA === player && pair.bodyB === wall) || (pair.bodyB === player && pair.bodyA === wall)) {
        if (!gameOver) triggerGameOver();
      }
    });

    if (
      (pair.bodyA === player && pair.bodyB.parent && pair.bodyB.parent.label === "spike") ||
      (pair.bodyB === player && pair.bodyA.parent && pair.bodyA.parent.label === "spike")
    ) {
      if (!gameOver) triggerGameOver();
      return;
    }

    if (
      (pair.bodyA === player && pair.bodyB.parent && pair.bodyB.parent.label === "popupSpike") ||
      (pair.bodyB === player && pair.bodyA.parent && pair.bodyA.parent.label === "popupSpike")
    ) {
      if (!gameOver) triggerGameOver();
      return;
    }
  });
});

function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  saveScore(score);

  playBGM.pause();
  deathSound.currentTime = 0;
  deathSound.play().catch(e => console.log("デス音の再生がブロックされました", e));
}

function drawBody(body, color) {
  ctx.save();
  ctx.translate(body.position.x - cameraX, body.position.y);

  if (body !== player && body.label !== "spike" && body.label !== "popupSpike") {
    ctx.rotate(body.angle);
  }

  if (body.label === "spike" || body.label === "popupSpike") {
    for (let i = 1; i < body.parts.length; i++) {
      const part = body.parts[i];
      ctx.save();
      ctx.translate(part.position.x - body.position.x, part.position.y - body.position.y);
      ctx.rotate(body.angle);

      if (body.label !== "popupSpike") {
        let currentBodyScore = Math.floor((body.position.x - 200) / 100);
        if (!getGravityState(currentBodyScore)) {
          ctx.scale(1, -1); 
        }
      }

      if (spikeImage.complete && spikeImage.width > 0) {
        const imgSize = 50;
        ctx.drawImage(spikeImage, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -25); 
        ctx.lineTo(22, 15);  
        ctx.lineTo(-22, 15); 
        ctx.closePath();
        ctx.fillStyle = "purple"; 
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
    return;
  }

  if (body.circleRadius) {
    if (body === player) {
      const size = 50;
      if (getGravityState(score)) {
        ctx.scale(1, -1);
      }
      
      const currentSkinImg = playerImages[currentSkinIndex];
      
      if (currentSkinImg && currentSkinImg.naturalWidth > 0) {
        const imgWidth = currentSkinImg.width;
        const imgHeight = currentSkinImg.height;
        const drawHeight = size * (imgHeight / imgWidth);

        ctx.drawImage(
          currentSkinImg,
          -size / 2,
          -drawHeight / 2,
          size,
          drawHeight
        );
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  } else {
    const width = body.bounds.max.x - body.bounds.min.x;
    const height = body.bounds.max.y - body.bounds.min.y;

    if (grounds.includes(body) || fakeGrounds.includes(body) || ceilings.includes(body)) {
      ctx.drawImage(groundImage, -width / 2, -height / 2, width, height);

      if (fakeGrounds.includes(body)) {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";        
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(-width / 2, -height / 2, width, height);
    }
  }
  ctx.restore();
}

function gameLoop() {
  let isPopupSpikeClose = false;
  popupSpikes.forEach((spike) => {
    const distance = Math.abs(player.position.x - spike.position.x);
    if (distance < 300) { 
      isPopupSpikeClose = true;
    }
  });

  const slowFactor = isPopupSpikeClose ? 0.8 : 1.0;

  if (gameStarted) {
    Engine.update(engine, 1000 / 60 * slowFactor);
  }
  Body.setAngle(player, 0);

  if (drawing) {
    const elapsedTime = Date.now() - drawStartTime;
    if (elapsedTime >= maxDrawTime) releaseLines();
  }

  if (!gameStarted) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(gameLoop);
    return;
  }

  if (!gameOver) {
    playerSpeed = basePlayerSpeed * slowFactor;
    Body.setVelocity(player, { x: playerSpeed, y: player.velocity.y });

    cameraX = player.position.x - canvas.width * 0.1;
    
    score = Math.max(0, Math.floor((player.position.x - 200) / 100));

    if (getGravityState(score)) {
      engine.world.gravity.y = -0.7; 
    } else {
      engine.world.gravity.y = 0.7;  
    }

    if (currentX < cameraX + canvas.width + 800) {
      generateSegment();
    }

    spikes.forEach((spike) => {
      if (!spike.isTriggered && player.position.x >= spike.position.x - 250) {
        spike.isTriggered = true;
        Body.setStatic(spike, false); 
      }
    });

    popupSpikes.forEach((spike) => {
      if (!spike.isTriggered && player.position.x >= spike.position.x - 180) {
        spike.isTriggered = true;
        const currentGroundY = canvas.height - 40;
        Body.setPosition(spike, { x: spike.position.x, y: currentGroundY - 55 });
      }
    });

    for (let i = grounds.length - 1; i >= 0; i--) {
      if (grounds[i].position.x < cameraX - 600) { World.remove(world, grounds[i]); grounds.splice(i, 1); }
    }
    for (let i = fakeGrounds.length - 1; i >= 0; i--) {
      if (fakeGrounds[i].position.x < cameraX - 600) { World.remove(world, fakeGrounds[i]); fakeGrounds.splice(i, 1); }
    }
    for (let i = ceilings.length - 1; i >= 0; i--) {
      if (ceilings[i].position.x < cameraX - 600) { World.remove(world, ceilings[i]); ceilings.splice(i, 1); }
    }
    for (let i = walls.length - 1; i >= 0; i--) {
      if (walls[i].position.x < cameraX - 600) { World.remove(world, walls[i]); walls.splice(i, 1); }
    }
    for (let i = spikes.length - 1; i >= 0; i--) {
      if (spikes[i].position.x < cameraX - 600 || spikes[i].position.y > canvas.height + 300) { World.remove(world, spikes[i]); spikes.splice(i, 1); }
    }
    for (let i = popupSpikes.length - 1; i >= 0; i--) {
      if (popupSpikes[i].position.x < cameraX - 600) { World.remove(world, popupSpikes[i]); popupSpikes.splice(i, 1); }
    }

    if (getGravityState(score)) {
      if (player.position.y < 0) { triggerGameOver(); }
    } else {
      if (player.position.y > canvas.height + 200) { triggerGameOver(); }
    }

    if (Math.abs(player.velocity.x) < 0.5) { stoppedTime += (1 / 60) * slowFactor; } else { stoppedTime = 0; }
    if (stoppedTime >= 3) { triggerGameOver(); }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameStarted && backgroundImage.complete && backgroundImage.width > 0) {
    const bgSpeed = 0.3;
    const bgHeight = canvas.height;
    const bgWidth = backgroundImage.width * (canvas.height / backgroundImage.height);
    let bgX = -((cameraX * bgSpeed) % bgWidth);
    if (bgX > 0) bgX -= bgWidth;

    ctx.drawImage(backgroundImage, bgX, 0, bgWidth, bgHeight);
    ctx.drawImage(backgroundImage, bgX + bgWidth - 1, 0, bgWidth, bgHeight);
    ctx.drawImage(backgroundImage, bgX + bgWidth * 2 - 2, 0, bgWidth, bgHeight);
  } else if (gameStarted) {
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ceilings.forEach((ceiling) => {
    const ceilX = ceiling.position.x - segmentWidth / 2 - cameraX;
    if (ceilX + segmentWidth > 0 && ceilX < canvas.width) {
      ctx.save();
      ctx.fillStyle = "rgba(138, 43, 226, 0.20)"; 
      ctx.fillRect(ceilX, 0, segmentWidth, canvas.height);
      ctx.restore();
    }
  });

  spikes.forEach((spike) => { drawBody(spike, "purple"); }); 
  popupSpikes.forEach((spike) => { drawBody(spike, "purple"); }); 
  grounds.forEach((ground) => { drawBody(ground, "black"); });
  fakeGrounds.forEach((fg) => { drawBody(fg, "black"); });
  ceilings.forEach((ceiling) => { drawBody(ceiling, "black"); }); 
  walls.forEach((wall) => { drawBody(wall, "gray"); });

  world.bodies.forEach((body) => {
    if (body !== player && !grounds.includes(body) && !fakeGrounds.includes(body) && !ceilings.includes(body) && !walls.includes(body) && !spikes.includes(body) && !popupSpikes.includes(body)) {
      drawBody(body, "black");
    }
  });

  drawBody(player, "red");

  if (isPopupSpikeClose && !gameOver) {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.8
    );
    gradient.addColorStop(0, "rgba(255, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(255, 0, 0, 0.35)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // --- スタイリッシュなゲームオーバー画面 ---
  if (gameOver) {
    ctx.save();

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 50px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
    ctx.shadowBlur = 20;

    const gradient = ctx.createLinearGradient(
      canvas.width / 2, canvas.height / 2 - 60,
      canvas.width / 2, canvas.height / 2 + 20
    );
    gradient.addColorStop(0, "#ff3333");
    gradient.addColorStop(1, "#990000");

    ctx.fillStyle = gradient;
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

    ctx.shadowBlur = 0;
    ctx.font = "bold 22px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`SCORE : ${score}m`, canvas.width / 2, canvas.height / 2 + 20);

    const btnX = canvas.width / 2 - 110;
    const btnY = canvas.height / 2 + 70;
    const btnW = 220;
    const btnH = 50;

    ctx.fillStyle = "#222222";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.font = "bold 18px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("タイトルに戻る", canvas.width / 2, btnY + btnH / 2);

    ctx.restore();
    ctx.textAlign = "left";
  }

  // ==========================================
  // ✨ スタイリッシュな上部UI（スコア & インクゲージ）
  // ==========================================
  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(20, 20, 160, 45, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 22px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(`${score} m`, 35, 50);

  const gaugeX = 200;
  const gaugeY = 20;
  const gaugeW = 180;
  const gaugeH = 45;

  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 8);
  ctx.fill();
  ctx.stroke();

  const timeSinceLastRelease = Date.now() - lastReleaseTime;
  let chargeRatio = Math.min(1, timeSinceLastRelease / cooldownDuration);

  if (chargeRatio < 1) {
    ctx.fillStyle = "rgba(255, 50, 50, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gaugeX + 6, gaugeY + 6, (gaugeW - 12) * chargeRatio, gaugeH - 12, 5);
    ctx.fill();

    ctx.font = "bold 13px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = "#ff8888";
    ctx.textAlign = "center";
    ctx.fillText(`RECHARGING...`, gaugeX + gaugeW / 2, gaugeY + 28);
  } else {
    ctx.fillStyle = "rgba(50, 220, 100, 0.6)";
    ctx.beginPath();
    ctx.roundRect(gaugeX + 6, gaugeY + 6, gaugeW - 12, gaugeH - 12, 5);
    ctx.fill();

    ctx.font = "bold 15px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`INK READY`, gaugeX + gaugeW / 2, gaugeY + 28);
  }

  ctx.restore();

  // --- 重力反転の警告 ---
  let showWarning = false;
  if ((score >= 75 && score < 90) || (score > 200 && (score - 200) % 150 >= 135)) {
    showWarning = true;
  }

  const warningEl = document.getElementById("gravity-warning");
  if (warningEl) {
    if (showWarning && !gameOver) {
      warningEl.classList.remove("hidden");
    } else {
      warningEl.classList.add("hidden");
    }
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-button");
  const startScreen = document.getElementById("start-screen");
  const countdownDisplay = document.getElementById("countdown-display");

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startBtn.style.display = "none";
      const otherBtns = startScreen.querySelectorAll("a");
      otherBtns.forEach(btn => btn.style.display = "none");

      if (startScreen) {
        startScreen.classList.add("hidden");
      }

      if (countdownDisplay) {
        countdownDisplay.style.display = "block";
        
        let count = 3;
        countdownDisplay.textContent = count;

        const timer = setInterval(() => {
          count--;
          if (count > 0) {
            countdownDisplay.textContent = count;
          } else if (count === 0) {
            countdownDisplay.textContent = "GO!";
          } else {
            clearInterval(timer);
            countdownDisplay.style.display = "none";
            gameStarted = true; 

            playBGM.currentTime = 0;
            playBGM.play().catch(e => console.log("BGMの再生がブロックされました", e));
          }
        }, 1000);
      }
    });
  }
});

gameLoop();