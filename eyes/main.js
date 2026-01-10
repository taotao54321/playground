"use strict";

const MEOW_SOUNDS = [
    get_audio("meow-01"),
    get_audio("meow-02"),
    get_audio("meow-03"),
    get_audio("meow-04"),
];

const [CANVAS_W, CANVAS_H] = get_canvas_size();

const EYE_W = CANVAS_W / 6;
const EYE_H = EYE_W * 2;

const assert = console.assert;

function rand_range_float(...args) {
    const [start, end] = args;

    assert(start < end);

    return start + (end - start) * Math.random();
}

function rand_range_int(...args) {
    const [start, end] = args;

    assert(start < end);
    assert(Number.isSafeInteger(start));
    assert(Number.isSafeInteger(end));

    return Math.floor(rand_range_float(start, end));
}

function rand_choose_array(...args) {
    const [xs] = args;

    const i = rand_range_int(0, xs.length);

    return xs[i];
}

function get_canvas() {
    return document.getElementById("canvas");
}

function get_canvas_size() {
    const canvas = get_canvas();

    return [canvas.width, canvas.height];
}

function get_audio(...args) {
    const [id] = args;

    return document.getElementById(id);
}

document.addEventListener("DOMContentLoaded", main);

function main() {
    get_canvas().addEventListener("pointerdown", on_pointerdown);

    tick(60);
}

const model = model_new();

function model_new() {
    const eyes = [
        eye_new(CANVAS_W / 2 - EYE_W, CANVAS_H / 2, EYE_W, EYE_H),
        eye_new(CANVAS_W / 2 + EYE_W, CANVAS_H / 2, EYE_W, EYE_H),
    ];

    return {
        dst: dst_new(),
        cat: cat_new(),
        eyes: eyes,
    };
}

function dst_new() {
    return {
        x: CANVAS_W * rand_range_float(0.1, 0.9),
        y: CANVAS_H * rand_range_float(0.1, 0.9),
    };
}

function cat_new() {
    return {
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        speed: 4.0,
    };
}

function eye_new(...args) {
    const [x, y, w, h] = args;

    return {
        x: x,
        y: y,
        w: w,
        h: h,
    };
}

function on_pointerdown(...args) {
    const [ev] = args;

    model.dst.x = ev.offsetX;
    model.dst.y = ev.offsetY;

    const sound = rand_choose_array(MEOW_SOUNDS);
    sound.play();
}

function tick(...args) {
    const [fps] = args;
    const fps_delay = 1000.0 / fps;

    let timestamp_pre = performance.now();
    let elapsed = 0.0;

    requestAnimationFrame(callback);

    function callback(timestamp) {
        elapsed += timestamp - timestamp_pre;

        if (elapsed > fps_delay) {
            update();

            draw(get_canvas().getContext("2d"));

            elapsed -= fps_delay;
        }

        timestamp_pre = timestamp;

        requestAnimationFrame(callback);
    }
}

function update() {
    const cat = model.cat;
    const dst = model.dst;

    const dist = Math.hypot(dst.x - cat.x, dst.y - cat.y);
    if (dist >= 4.0) {
        const angle = Math.atan2(dst.y - cat.y, dst.x - cat.x);
        const dx = cat.speed * Math.cos(angle);
        const dy = cat.speed * Math.sin(angle);
        cat.x += dx;
        cat.y += dy;
    }
}

function draw(...args) {
    const [ctx] = args;

    draw_background(ctx);

    for (const eye of model.eyes) {
        draw_eye(ctx, eye);
    }

    draw_dst(ctx, model.dst);

    draw_cat(ctx, model.cat);
}

function draw_background(...args) {
    const [ctx] = args;

    ctx.save();

    ctx.fillStyle = "#50b000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.restore();
}

function draw_dst(...args) {
    const [ctx, dst] = args;

    const cat = model.cat;

    // 一定以上近かったら描画しない。
    const dist = Math.hypot(dst.x - cat.x, dst.y - cat.y);
    if (dist < 4.0) {
        return;
    }

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `48px serif`;
    ctx.strokeText("🐟", dst.x, dst.y);

    ctx.restore();
}

function draw_cat(...args) {
    const [ctx, cat] = args;

    const dst = model.dst;

    const flip = dst.x > cat.x;

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `48px serif`;
    ctx.translate(cat.x, cat.y);
    if (flip) {
        ctx.scale(-1, 1);
    }
    ctx.strokeText("🐈", 0, 0);

    ctx.restore();
}

function draw_eye(...args) {
    const [ctx, eye] = args;

    const cat = model.cat;
    const [ball_x, ball_y] = calc_ball_pos(cat, eye);

    ctx.save();

    ctx.lineWidth = 8;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y, eye.w / 2, eye.h / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(ball_x, ball_y, 8, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
}

function calc_ball_pos(...args) {
    const [cat, eye] = args;

    const RX = 0.7 * (EYE_W / 2.0);
    const RY = 0.7 * (EYE_H / 2.0);

    const angle = Math.atan2(cat.y - eye.y, cat.x - eye.x);
    const x = eye.x + RX * Math.cos(angle);
    const y = eye.y + RY * Math.sin(angle);

    const dist_to_cat = Math.hypot(cat.x - eye.x, cat.y - eye.y);
    const dist_to_ball = Math.hypot(x - eye.x, y - eye.y);
    if (dist_to_cat <= dist_to_ball) {
        return [cat.x, cat.y];
    } else {
        return [x, y];
    }
}
