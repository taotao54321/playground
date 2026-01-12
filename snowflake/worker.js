"use strict";

function rgb_to_u32_le(r, g, b) {
    return r | (g << 8) | (b << 16) | (0xFF << 24);
}

function rgb_to_u32_be(r, g, b) {
    return (r << 24) | (g << 16) | (b << 8) | 0xFF;
}

const rgb_to_u32 = (() => {
    const buf = new ArrayBuffer(4);
    const buf_u32 = new Uint32Array(buf);
    buf_u32[0] = 0x12345678;
    const buf_u8 = new Uint8Array(buf);
    const le = buf_u8[0] === 0x78;

    return le ? rgb_to_u32_le : rgb_to_u32_be;
})();

self.onmessage = (ev) => {
    if (ev.data.cmd === "init") {
        init(ev.data.width, ev.data.height);
    } else if (ev.data.cmd === "restart") {
        restart(ev.data.params);
    } else if (ev.data.cmd === "tick") {
        tick(ev.data.params);
    }
};

const app = {
    width: null,
    height: null,
    image_data: null,

    // a, d については近傍セルの値に依存して更新されるため、作業用配列が必要。
    a: null,
    a_nxt: null,
    b: null,
    c: null,
    d: null,
    d_nxt: null,
};

function init(w, h) {
    app.width = w;
    app.height = h;
    app.image_data = new ImageData(w, h);

    // 番兵も含めた配列長。
    const len = (w + 2) * (h + 2);

    app.a = new Uint8Array(new ArrayBuffer(len));
    app.a_nxt = new Uint8Array(new ArrayBuffer(len));
    app.b = new Float64Array(new ArrayBuffer(8 * len));
    app.c = new Float64Array(new ArrayBuffer(8 * len));
    app.d = new Float64Array(new ArrayBuffer(8 * len));
    app.d_nxt = new Float64Array(new ArrayBuffer(8 * len));
}

function restart(params) {
    const w = app.width;
    const h = app.height;

    const rho = params.rho;

    app.a.fill(0);
    app.a_nxt.fill(0);
    app.b.fill(0.0);
    app.c.fill(0.0);
    app.d.fill(rho);
    app.d_nxt.fill(rho);

    const center = xyw2idx(Math.floor(w / 2), Math.floor(h / 2), w);
    app.a[center] = 1;
    app.b[center] = 0.0;
    app.c[center] = 1.0;
    app.d[center] = 0.0;
}

async function tick(params) {
    simulate(params);

    draw();

    const bitmap = await createImageBitmap(app.image_data);

    self.postMessage({ bitmap: bitmap }, [bitmap]);
}

function simulate(params) {
    simulate_diffusion();
    simulate_freezing(params.kappa);
    simulate_attachment(params.beta, params.alpha, params.theta);
    simulate_melting(params.mu, params.gamma);
}

function simulate_diffusion() {
    const w = app.width;
    const h = app.height;

    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            const i = xyw2idx(x, y, w);
            const diffuse = app.a[i] === 0;
            if (diffuse) {
                let sum = app.d[i];
                for (const j of neighbors(x, y, w)) {
                    if (app.a[j] === 0) {
                        sum += app.d[j];
                    } else {
                        sum += app.d[i];
                    }
                }
                app.d_nxt[i] = sum / 7.0;
            } else {
                app.d_nxt[i] = 0.0;
            }
        }
    }

    [app.d, app.d_nxt] = [app.d_nxt, app.d];
}

function simulate_freezing(kappa) {
    const w = app.width;
    const h = app.height;

    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            const i = xyw2idx(x, y, w);
            const freeze = app.a[i] === 0 && neighbors(x, y, w).some((j) => app.a[j] !== 0);
            if (freeze) {
                app.b[i] += (1.0 - kappa) * app.d[i];
                app.c[i] += kappa * app.d[i];
                app.d[i] = 0.0;
            }
        }
    }
}

function simulate_attachment(beta, alpha, theta) {
    const w = app.width;
    const h = app.height;

    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            const i = xyw2idx(x, y, w);
            if (app.a[i] !== 0) {
                app.a_nxt[i] = 1;
                continue;
            }
            const js = neighbors(x, y, w);
            const count = js.filter((j) => app.a[j] !== 0).length;
            let attach = false;
            if (1 <= count && count <= 2) {
                attach = app.b[i] >= beta;
            } else if (count === 3) {
                if (app.b[i] >= 1.0) {
                    attach = true;
                } else if (app.b[i] < alpha) {
                    attach = false;
                } else {
                    let sum = 0.0;
                    for (const j of js) {
                        sum += app.d[j];
                    }
                    attach = sum < theta;
                }
            } else if (4 <= count) {
                attach = true;
            }
            if (attach) {
                app.a_nxt[i] = 1;
                app.c[i] += app.b[i];
                app.b[i] = 0.0;
            } else {
                app.a_nxt[i] = 0;
            }
        }
    }

    [app.a, app.a_nxt] = [app.a_nxt, app.a];
}

function simulate_melting(mu, gamma) {
    const w = app.width;
    const h = app.height;

    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            const i = xyw2idx(x, y, w);
            const melt = app.a[i] === 0 && neighbors(x, y, w).some((j) => app.a[j] !== 0);
            if (melt) {
                const mu_b = mu * app.b[i];
                const gamma_c = gamma * app.c[i];
                app.b[i] -= mu_b;
                app.c[i] -= gamma_c;
                app.d[i] += mu_b + gamma_c;
            }
        }
    }
}

function neighbors(x, y, w) {
    const w2 = w + 2;
    const i = xyw2idx(x, y, w);

    if ((y & 1) === 0) {
        return [
            i - w2 - 1, i - w2,
            i - 1,      i + 1,
            i + w2 - 1, i + w2,
        ];
    } else {
        return [
            i - w2, i - w2 + 1,
            i - 1,  i + 1,
            i + w2, i + w2 + 1,
        ];
    }
}

function draw() {
    const w = app.width;
    const h = app.height;
    const fb = new Uint32Array(app.image_data.data.buffer);

    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            const [r, g, b] = cell_color(x, y, w);
            const i = w * y + x;
            fb[i] = rgb_to_u32(r, g, b);
        }
    }
}

function cell_color(x, y, w) {
    const cell = (() => {
        const i = xyw2idx(x, y, w);
        return {
            a: app.a[i] !== 0,
            d: app.d[i],
        };
    })();

    if (cell.a) {
        return [0xFF, 0xFF, 0xFF];
    } else {
        const coef = 1.0 - Math.min(1.0, cell.d);
        return [
            0,
            Math.floor(115.0 * coef),
            Math.floor(153.0 * coef),
        ];
    }
}

function xyw2idx(x, y, w) {
    return (w + 2) * (y + 1) + (x + 1);
}
