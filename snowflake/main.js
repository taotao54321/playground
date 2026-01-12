// 参考:
//
// * [Modeling snow crystal growth II: A mesoscopic lattice map with plausible dynamics](https://doi.org/10.1016/j.physd.2007.09.008)
// * [RustとBevyで雪の結晶のシミュレーションをする](https://zenn.dev/galapagos/articles/snowflake-simulator-in-rust)

"use strict";

const PARAMS_INI = {
    rho:   0.5,
    kappa: 0.003,
    beta:  1.21,
    alpha: 0.07,
    theta: 0.025,
    mu:    0.07,
    gamma: 0.00005,
};

const CANVAS = document.getElementById("canvas");

const [WORLD_W, WORLD_H] = [CANVAS.width, CANVAS.height];

const blit = (() => {
    const ctx_br = CANVAS.getContext("bitmaprenderer");
    if (ctx_br && typeof ctx_br.transferFromImageBitmap === "function") {
        return (bitmap) => {
            ctx_br.transferFromImageBitmap(bitmap);
        };
    }

    const ctx_2d = CANVAS.getContext("2d");
    return (bitmap) => {
        ctx_2d.drawImage(bitmap, 0, 0);
        bitmap.close();
    };
})();

let worker = null;
let paused = false;

const form = {
    reset: document.getElementById("reset"),
    restart: document.getElementById("restart"),
    pause: document.getElementById("pause"),
    rho: document.getElementById("rho"),
    rho_value: document.getElementById("rho_value"),
    kappa: document.getElementById("kappa"),
    kappa_value: document.getElementById("kappa_value"),
    beta: document.getElementById("beta"),
    beta_value: document.getElementById("beta_value"),
    alpha: document.getElementById("alpha"),
    alpha_value: document.getElementById("alpha_value"),
    theta: document.getElementById("theta"),
    theta_value: document.getElementById("theta_value"),
    mu: document.getElementById("mu"),
    mu_value: document.getElementById("mu_value"),
    gamma: document.getElementById("gamma"),
    gamma_value: document.getElementById("gamma_value"),
};

document.addEventListener("DOMContentLoaded", main);

function main() {
    init_worker();
    init_form();
}

function init_worker() {
    worker = new Worker("worker.js");

    worker.onmessage = (ev) => {
        const bitmap = ev.data.bitmap;
        blit(bitmap);
        if (!paused) {
            worker.postMessage(msg_tick());
        }
    };

    worker.postMessage(msg_init());
    worker.postMessage(msg_restart());
    if (!paused) {
        worker.postMessage(msg_tick());
    }
}

function init_form() {
    form.reset.addEventListener("click", (_ev) => {
        reset_params();
    });

    form.restart.addEventListener("click", (_ev) => {
        worker.postMessage(msg_restart());
        worker.postMessage(msg_tick());
    });

    form.pause.addEventListener("click", (_ev) => {
        paused = !paused;
        pause_state_changed();
        if (!paused) {
            worker.postMessage(msg_tick());
        }
    });
    pause_state_changed();

    const setup_param_io = (input, output) => {
        input.addEventListener("input", (_ev) => {
            param_changed(input, output);
        });
        param_changed(input, output);
    };

    setup_param_io(form.rho,   form.rho_value);
    setup_param_io(form.kappa, form.kappa_value);
    setup_param_io(form.beta,  form.beta_value);
    setup_param_io(form.alpha, form.alpha_value);
    setup_param_io(form.theta, form.theta_value);
    setup_param_io(form.mu,    form.mu_value);
    setup_param_io(form.gamma, form.gamma_value);

    reset_params();
}

function reset_params() {
    const f = (input, output, value) => {
        input.value = value;
        param_changed(input, output);
    };

    f(form.rho, form.rho_value, PARAMS_INI.rho);
    f(form.kappa, form.kappa_value, PARAMS_INI.kappa);
    f(form.beta, form.beta_value, PARAMS_INI.beta);
    f(form.alpha, form.alpha_value, PARAMS_INI.alpha);
    f(form.theta, form.theta_value, PARAMS_INI.theta);
    f(form.mu, form.mu_value, PARAMS_INI.mu);
    f(form.gamma, form.gamma_value, PARAMS_INI.gamma);
}

function pause_state_changed() {
    form.pause.value = paused ? "▶️" : "⏸️";
}

function param_changed(input, output) {
    output.value = parseFloat(input.value).toFixed(5);
}

function msg_init() {
    return {
        cmd: "init",
        width: WORLD_W,
        height: WORLD_H,
    };
}

function msg_restart() {
    return {
        cmd: "restart",
        params: get_params(),
    };
}

function msg_tick() {
    return {
        cmd: "tick",
        params: get_params(),
    };
}

const get_params = (() => {
    const get = (elt) => parseFloat(elt.value);

    return () => {
        return {
            rho: get(form.rho),
            kappa: get(form.kappa),
            beta: get(form.beta),
            alpha: get(form.alpha),
            theta: get(form.theta),
            mu: get(form.mu),
            gamma: get(form.gamma),
        };
    };
})();
