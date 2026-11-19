const HOLD_MS = 650;
const FRAME_MS = 50;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function connectCamera({ button, video, cursor, status, canSelect }) {
  let landmarker;
  let stream;
  let raf;
  let lastFrame = -Infinity;
  let lastVideoTime = -1;
  let position;
  let target;
  let started;
  let selected;
  let pen = null; // kanvas jurus yang sedang digambar dengan cubitan
  let pinched = false;

  function message(text) {
    status.hidden = false;
    status.textContent = text;
  }

  function clearTarget() {
    if (target) {
      target.classList.remove("is-hover");
      target.style.removeProperty("--hold");
    }
    target = null;
    selected = false;
  }

  function penEvent(type, canvas) {
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: "pen", button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: position.x, clientY: position.y, bubbles: true }));
  }
  function liftPen() {
    if (pen && position) penEvent("pointerup", pen);
    pen = null;
    cursor.classList.remove("is-drawing");
  }

  function stop() {
    liftPen();
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    cursor.hidden = true;
    position = null;
    lastVideoTime = -1;
    lastFrame = -Infinity;
    clearTarget();
    button.textContent = "Aktifkan kamera";
    button.setAttribute("aria-pressed", "false");
  }

  function track(now) {
    if (!stream) return;
    raf = requestAnimationFrame(track);
    if (now - lastFrame < FRAME_MS || video.readyState < 2 || lastVideoTime === video.currentTime) return;
    lastFrame = now;
    lastVideoTime = video.currentTime;
    let hand;
    try {
      hand = landmarker.detectForVideo(video, now).landmarks[0];
    } catch (error) {
      console.warn("Pelacakan tangan berhenti.", error);
      stop();
      message("Pelacakan tangan berhenti. Aktifkan ulang kamera atau lanjut pakai mouse.");
      return;
    }

    if (!hand) {
      liftPen();
      cursor.hidden = true;
      position = null;
      clearTarget();
      return;
    }

    // The palm center stays steadier than a fingertip when visitors move their hands.
    const palm = hand[9];
    const x = clamp((0.86 - palm.x) / 0.72, 0, 1) * (innerWidth - 2);
    const y = clamp((palm.y - 0.16) / 0.68, 0, 1) * (innerHeight - 2);
    position = position ? {
      x: position.x * 0.55 + x * 0.45,
      y: position.y * 0.55 + y * 0.45,
    } : { x, y };
    cursor.hidden = false;
    cursor.style.transform = `translate(${position.x}px,${position.y}px) translate(-50%,-50%)`;

    // Cubit jempol + telunjuk = pena turun. Ambang relatif terhadap ukuran tangan, dengan histeresis.
    const span = Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y) || 0.1;
    const gap = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) / span;
    pinched = pinched ? gap < 0.45 : gap < 0.3;
    cursor.classList.toggle("is-pinch", pinched);
    const pad = document.elementFromPoint(position.x, position.y)?.closest(".rune-pad canvas");
    if (pinched && !pen && pad) { pen = pad; cursor.classList.add("is-drawing"); penEvent("pointerdown", pen); }
    else if (pinched && pen) { if (pen.isConnected) penEvent("pointermove", pen); else liftPen(); }
    else if (!pinched && pen) liftPen();
    if (pen) { clearTarget(); return; }

    const next = canSelect()
      ? document.elementFromPoint(position.x, position.y)?.closest("[data-dwell]:not(:disabled)")
      : null;
    if (next !== target) {
      clearTarget();
      target = next;
      if (target) {
        started = now;
        target.classList.add("is-hover");
      }
    }
    if (!target || selected) return;
    const progress = clamp((now - started) / HOLD_MS, 0, 1);
    target.style.setProperty("--hold", `${progress * 100}%`);
    if (progress === 1) {
      selected = true;
      target.click();
    }
  }

  button.addEventListener("click", async () => {
    if (stream) {
      stop();
      message("Kamera mati. Mouse dan sentuh tetap bisa dipakai.");
      return;
    }
    button.disabled = true;
    button.textContent = "Menyiapkan kamera…";
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Buka arena dari localhost atau HTTPS untuk memakai kamera.");
      }
      if (!landmarker) {
        const { FilesetResolver, HandLandmarker } = await import("./vendor/vision_bundle.mjs");
        const runtime = await FilesetResolver.forVisionTasks(new URL("./vendor/wasm", import.meta.url).href);
        landmarker = await HandLandmarker.createFromOptions(runtime, {
          baseOptions: { modelAssetPath: new URL("./vendor/hand_landmarker.task", import.meta.url).href },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      button.textContent = "Matikan kamera";
      button.setAttribute("aria-pressed", "true");
      message("Kamera aktif. Angkat satu tangan: tahan kursor di atas pilihan untuk memilih, cubit jempol + telunjuk untuk menggambar jurus. Video diproses di perangkat.");
      raf = requestAnimationFrame(track);
    } catch (error) {
      console.warn("Gagal memulai kamera.", error);
      stop();
      message(error.name === "NotAllowedError"
        ? "Izin kamera belum diberikan. Izinkan di browser atau lanjut pakai mouse."
        : "Kamera belum bisa dipakai. Cek webcam dan jalankan setup-camera.py jika aset kamera belum terpasang. Mouse tetap bisa dipakai.");
    } finally {
      button.disabled = false;
    }
  });
  window.addEventListener("pagehide", stop);
}
