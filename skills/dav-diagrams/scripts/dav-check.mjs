// Generated from apps/vscode/src/skill/checkEntry.ts. Do not edit.
import { readFileSync as e, writeFileSync as t } from "node:fs";
// src/model/text.ts
var n = 11.5, r = {
	normal: [
		31,
		32,
		44,
		67,
		61,
		92,
		90,
		26,
		34,
		34,
		47,
		77,
		25,
		45,
		25,
		44,
		61,
		61,
		61,
		61,
		61,
		61,
		61,
		61,
		61,
		61,
		25,
		25,
		77,
		77,
		77,
		51,
		107,
		73,
		65,
		70,
		79,
		57,
		55,
		77,
		80,
		30,
		40,
		65,
		53,
		101,
		84,
		85,
		63,
		85,
		67,
		60,
		59,
		77,
		70,
		105,
		67,
		62,
		64,
		34,
		43,
		34,
		77,
		47,
		31,
		58,
		66,
		52,
		66,
		59,
		36,
		66,
		64,
		28,
		28,
		56,
		28,
		97,
		64,
		66,
		66,
		66,
		39,
		48,
		38,
		64,
		54,
		81,
		52,
		55,
		51,
		34,
		27,
		34,
		77
	],
	bold: [
		31,
		37,
		56,
		67,
		65,
		98,
		96,
		33,
		42,
		42,
		51,
		80,
		31,
		46,
		31,
		50,
		65,
		65,
		65,
		65,
		65,
		65,
		65,
		65,
		65,
		65,
		31,
		31,
		80,
		80,
		80,
		50,
		107,
		79,
		72,
		70,
		83,
		60,
		59,
		80,
		86,
		36,
		50,
		73,
		58,
		108,
		89,
		85,
		69,
		85,
		74,
		63,
		66,
		81,
		75,
		113,
		74,
		68,
		68,
		42,
		49,
		42,
		80,
		47,
		36,
		61,
		70,
		54,
		70,
		61,
		43,
		70,
		68,
		32,
		32,
		63,
		32,
		103,
		68,
		69,
		70,
		70,
		45,
		50,
		44,
		68,
		61,
		90,
		62,
		61,
		54,
		42,
		37,
		42,
		80
	]
}, i = 32, a = 126, o = {
	normal: .6,
	bold: .65,
	mono: .605
}, s = 1, c = 1.4, l = 127744;
function u(e, t) {
	let n = e.codePointAt(0) ?? 0;
	return t !== "mono" && n >= i && n <= a ? r[t][n - i] / 100 : f(e) ? n >= l ? c : s : o[t];
}
function d(e, t, n = "normal") {
	let r = 0;
	for (let t of e) r += u(t, n);
	return r * t;
}
function f(e) {
	if (p(e)) return !0;
	let t = e.codePointAt(0) ?? 0;
	return t === 165 || t === 183 || t === 215 || t === 247 || t >= 8192 && t <= 11263 || t >= 12288 && t <= 12351 || t >= 65024 && t <= 65135;
}
function p(e) {
	let t = e.codePointAt(0) ?? 0;
	return t >= 4352 && t <= 4447 || t >= 11904 && t <= 42191 || t >= 44032 && t <= 55203 || t >= 63744 && t <= 64255 || t >= 65072 && t <= 65103 || t >= 65280 && t <= 65376 || t >= 65504 && t <= 65510 || t >= 127744;
}
var m = /\p{White_Space}+$/u, h = /\P{White_Space}/u;
function g(e) {
	return !h.test(e);
}
function _(e) {
	return e.replace(m, "");
}
function v(e, t) {
	let n = e.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n"), r = (e) => e !== void 0 && g(e);
	if (t?.stripAllOuterBlankLines) {
		for (; r(n[0]);) n.shift();
		for (; r(n[n.length - 1]);) n.pop();
	} else n.length > 1 && (r(n[0]) && n.shift(), r(n[n.length - 1]) && n.pop());
	let i = n.map(_), a = Infinity;
	for (let e of i) {
		if (e.length === 0) continue;
		let t = /^ */.exec(e)?.[0].length ?? 0;
		t < a && (a = t);
	}
	return !Number.isFinite(a) || a === 0 ? i.join("\n") : i.map((e) => e.length > 0 ? e.slice(a) : "").join("\n");
}
function y(e, t) {
	let n = Number.isNaN(t) ? 0 : Math.max(0, Math.min(e.length, Math.trunc(t))), r = 1;
	for (let t = 0; t < n; t++) e.charCodeAt(t) === 10 && r++;
	return r;
}
function b(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
// src/model/types.ts
var x = /* @__PURE__ */ "server.container.function.runtime.database.cache.queue.storage.lb.firewall.cdn.cloud.building.router.hub.wifi.external.auth.ai.api.mail.monitor.schedule.search.logic.webhook.payment.key.dns.shield.stream.event.nat.registry.warehouse.vault.audit.screen.modal.browser.desktop.mobile.terminal.device.printer.chat.sheet.file.user.users.bot".split(".");
function S(e) {
	return x.includes(e);
}
var C = [
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"purple",
	"pink",
	"gray"
];
function w(e) {
	return C.includes(e);
}
var T = "none", E = [
	"title",
	"group",
	"node",
	"step",
	"desc",
	"focus",
	"state",
	"animate",
	"static",
	"true",
	"false"
], D = ["solid", "dashed"];
function O(e) {
	return D.includes(e);
}
var k = ["border"];
function A(e) {
	return k.includes(e);
}
function j(e, t) {
	return `${e}->${t}`;
}
var M = {
	node: {
		icon: "icon",
		sub: "string",
		badge: "string",
		visible: "bool",
		color: "color",
		mount: "mount"
	},
	group: {
		color: "color",
		border: "border"
	},
	state: {
		badge: "string",
		visible: "bool",
		color: "stateColor"
	},
	animate: {
		icon: "icon",
		color: "color",
		parallel: "bool",
		desc: "string",
		code: "string"
	},
	static: { color: "color" }
}, N = {
	node: /* @__PURE__ */ new Set([
		"badge",
		"visible",
		"color"
	]),
	group: /* @__PURE__ */ new Set(["color"])
}, P = [
	"-->",
	"..>",
	"<->",
	"<.>"
], F = {
	"-->": {
		style: "solid",
		direction: "forward"
	},
	"..>": {
		style: "dashed",
		direction: "forward"
	},
	"<->": {
		style: "solid",
		direction: "bidirectional"
	},
	"<.>": {
		style: "dashed",
		direction: "bidirectional"
	}
};
new Set(E);
// src/dsl/suggest.ts
function ee(e, t) {
	let n, r = 3, i = e.toLowerCase();
	for (let e of t) {
		let t = e.length <= 3 ? 1 : 2, a = I(i, e);
		a <= t && a < r && (n = e, r = a);
	}
	return n;
}
function I(e, t) {
	let n = Array.from({ length: t.length + 1 }, (e, t) => t);
	for (let r = 1; r <= e.length; r++) {
		let i = n[0] ?? 0, a = r;
		n[0] = a;
		for (let o = 1; o <= t.length; o++) {
			let s = n[o] ?? 0, c = e[r - 1] === t[o - 1] ? 0 : 1;
			a = Math.min(s + 1, a + 1, i + c), n[o] = a, i = s;
		}
	}
	return n[t.length] ?? 0;
}
// ../../node_modules/@lezer/common/dist/index.js
var te = 1024, ne = 0, re = class {
	constructor(e, t) {
		this.from = e, this.to = t;
	}
}, L = class {
	constructor(e = {}) {
		this.id = ne++, this.perNode = !!e.perNode, this.deserialize = e.deserialize || (() => {
			throw Error("This node type doesn't define a deserialize function");
		}), this.combine = e.combine || null;
	}
	add(e) {
		if (this.perNode) throw RangeError("Can't add per-node props to node types");
		return typeof e != "function" && (e = R.match(e)), (t) => {
			let n = e(t);
			return n === void 0 ? null : [this, n];
		};
	}
};
L.closedBy = new L({ deserialize: (e) => e.split(" ") }), L.openedBy = new L({ deserialize: (e) => e.split(" ") }), L.group = new L({ deserialize: (e) => e.split(" ") }), L.isolate = new L({ deserialize: (e) => {
	if (e && e != "rtl" && e != "ltr" && e != "auto") throw RangeError("Invalid value for isolate: " + e);
	return e || "auto";
} }), L.contextHash = new L({ perNode: !0 }), L.lookAhead = new L({ perNode: !0 }), L.mounted = new L({ perNode: !0 });
var ie = class {
	constructor(e, t, n, r = !1) {
		this.tree = e, this.overlay = t, this.parser = n, this.bracketed = r;
	}
	static get(e) {
		return e && e.props && e.props[L.mounted.id];
	}
}, ae = Object.create(null), R = class e {
	constructor(e, t, n, r = 0) {
		this.name = e, this.props = t, this.id = n, this.flags = r;
	}
	static define(t) {
		let n = t.props && t.props.length ? Object.create(null) : ae, r = +!!t.top | (t.skipped ? 2 : 0) | (t.error ? 4 : 0) | (t.name == null ? 8 : 0), i = new e(t.name || "", n, t.id, r);
		if (t.props) {
			for (let e of t.props) if (Array.isArray(e) || (e = e(i)), e) {
				if (e[0].perNode) throw RangeError("Can't store a per-node prop on a node type");
				n[e[0].id] = e[1];
			}
		}
		return i;
	}
	prop(e) {
		return this.props[e.id];
	}
	get isTop() {
		return (this.flags & 1) > 0;
	}
	get isSkipped() {
		return (this.flags & 2) > 0;
	}
	get isError() {
		return (this.flags & 4) > 0;
	}
	get isAnonymous() {
		return (this.flags & 8) > 0;
	}
	is(e) {
		if (typeof e == "string") {
			if (this.name == e) return !0;
			let t = this.prop(L.group);
			return t ? t.indexOf(e) > -1 : !1;
		}
		return this.id == e;
	}
	static match(e) {
		let t = Object.create(null);
		for (let n in e) for (let r of n.split(" ")) t[r] = e[n];
		return (e) => {
			for (let n = e.prop(L.group), r = -1; r < (n ? n.length : 0); r++) {
				let i = t[r < 0 ? e.name : n[r]];
				if (i) return i;
			}
		};
	}
};
R.none = new R("", Object.create(null), 0, 8);
var oe = class e {
	constructor(e) {
		this.types = e;
		for (let t = 0; t < e.length; t++) if (e[t].id != t) throw RangeError("Node type ids should correspond to array positions when creating a node set");
	}
	extend(...t) {
		let n = [];
		for (let e of this.types) {
			let r = null;
			for (let n of t) {
				let t = n(e);
				if (t) {
					r ||= Object.assign({}, e.props);
					let n = t[1], i = t[0];
					i.combine && i.id in r && (n = i.combine(r[i.id], n)), r[i.id] = n;
				}
			}
			n.push(r ? new R(e.name, r, e.id, e.flags) : e);
		}
		return new e(n);
	}
}, se = /* @__PURE__ */ new WeakMap(), ce = /* @__PURE__ */ new WeakMap(), z;
(function(e) {
	e[e.ExcludeBuffers = 1] = "ExcludeBuffers", e[e.IncludeAnonymous = 2] = "IncludeAnonymous", e[e.IgnoreMounts = 4] = "IgnoreMounts", e[e.IgnoreOverlays = 8] = "IgnoreOverlays", e[e.EnterBracketed = 16] = "EnterBracketed";
})(z ||= {});
var le = class e {
	constructor(e, t, n, r, i) {
		if (this.type = e, this.children = t, this.positions = n, this.length = r, this.props = null, i && i.length) {
			this.props = Object.create(null);
			for (let [e, t] of i) this.props[typeof e == "number" ? e : e.id] = t;
		}
	}
	toString() {
		let e = ie.get(this);
		if (e && !e.overlay) return e.tree.toString();
		let t = "";
		for (let e of this.children) {
			let n = e.toString();
			n && (t && (t += ","), t += n);
		}
		return this.type.name ? (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (t.length ? "(" + t + ")" : "") : t;
	}
	cursor(e = 0) {
		return new Ce(this.topNode, e);
	}
	cursorAt(e, t = 0, n = 0) {
		let r = new Ce(se.get(this) || this.topNode);
		return r.moveTo(e, t), se.set(this, r._tree), r;
	}
	get topNode() {
		return new he(this, 0, 0, null);
	}
	resolve(e, t = 0) {
		let n = pe(se.get(this) || this.topNode, e, t, !1);
		return se.set(this, n), n;
	}
	resolveInner(e, t = 0) {
		let n = pe(ce.get(this) || this.topNode, e, t, !0);
		return ce.set(this, n), n;
	}
	resolveStack(e, t = 0) {
		return Se(this, e, t);
	}
	iterate(e) {
		let { enter: t, leave: n, from: r = 0, to: i = this.length } = e, a = e.mode || 0, o = (a & z.IncludeAnonymous) > 0;
		for (let e = this.cursor(a | z.IncludeAnonymous);;) {
			let a = !1;
			if (e.from <= i && e.to >= r && (!o && e.type.isAnonymous || t(e) !== !1)) {
				if (e.firstChild()) continue;
				a = !0;
			}
			for (; a && n && (o || !e.type.isAnonymous) && n(e), !e.nextSibling();) {
				if (!e.parent()) return;
				a = !0;
			}
		}
	}
	prop(e) {
		return e.perNode ? this.props ? this.props[e.id] : void 0 : this.type.prop(e);
	}
	get propValues() {
		let e = [];
		if (this.props) for (let t in this.props) e.push([+t, this.props[t]]);
		return e;
	}
	balance(t = {}) {
		return this.children.length <= 8 ? this : Oe(R.none, this.children, this.positions, 0, this.children.length, 0, this.length, (t, n, r) => new e(this.type, t, n, r, this.propValues), t.makeTree || ((t, n, r) => new e(R.none, t, n, r)));
	}
	static build(e) {
		return Te(e);
	}
};
le.empty = new le(R.none, [], [], 0);
var ue = class e {
	constructor(e, t) {
		this.buffer = e, this.index = t;
	}
	get id() {
		return this.buffer[this.index - 4];
	}
	get start() {
		return this.buffer[this.index - 3];
	}
	get end() {
		return this.buffer[this.index - 2];
	}
	get size() {
		return this.buffer[this.index - 1];
	}
	get pos() {
		return this.index;
	}
	next() {
		this.index -= 4;
	}
	fork() {
		return new e(this.buffer, this.index);
	}
}, de = class e {
	constructor(e, t, n) {
		this.buffer = e, this.length = t, this.set = n;
	}
	get type() {
		return R.none;
	}
	toString() {
		let e = [];
		for (let t = 0; t < this.buffer.length;) e.push(this.childString(t)), t = this.buffer[t + 3];
		return e.join(",");
	}
	childString(e) {
		let t = this.buffer[e], n = this.buffer[e + 3], r = this.set.types[t], i = r.name;
		if (/\W/.test(i) && !r.isError && (i = JSON.stringify(i)), e += 4, n == e) return i;
		let a = [];
		for (; e < n;) a.push(this.childString(e)), e = this.buffer[e + 3];
		return i + "(" + a.join(",") + ")";
	}
	findChild(e, t, n, r, i) {
		let { buffer: a } = this, o = -1;
		for (let s = e; s != t && !(fe(i, r, a[s + 1], a[s + 2]) && (o = s, n > 0)); s = a[s + 3]);
		return o;
	}
	slice(t, n, r) {
		let i = this.buffer, a = new Uint16Array(n - t), o = 0;
		for (let e = t, s = 0; e < n;) {
			a[s++] = i[e++], a[s++] = i[e++] - r;
			let n = a[s++] = i[e++] - r;
			a[s++] = i[e++] - t, o = Math.max(o, n);
		}
		return new e(a, o, this.set);
	}
};
function fe(e, t, n, r) {
	switch (e) {
		case -2: return n < t;
		case -1: return r >= t && n < t;
		case 0: return n < t && r > t;
		case 1: return n <= t && r > t;
		case 2: return r > t;
		case 4: return !0;
	}
}
function pe(e, t, n, r) {
	for (; e.from == e.to || (n < 1 ? e.from >= t : e.from > t) || (n > -1 ? e.to <= t : e.to < t);) {
		let t = !r && e instanceof he && e.index < 0 ? null : e.parent;
		if (!t) return e;
		e = t;
	}
	let i = r ? 0 : z.IgnoreOverlays;
	if (r) for (let r = e, a = r.parent; a; r = a, a = r.parent) r instanceof he && r.index < 0 && a.enter(t, n, i)?.from != r.from && (e = a);
	for (;;) {
		let r = e.enter(t, n, i);
		if (!r) return e;
		e = r;
	}
}
var me = class {
	cursor(e = 0) {
		return new Ce(this, e);
	}
	getChild(e, t = null, n = null) {
		let r = ge(this, e, t, n);
		return r.length ? r[0] : null;
	}
	getChildren(e, t = null, n = null) {
		return ge(this, e, t, n);
	}
	resolve(e, t = 0) {
		return pe(this, e, t, !1);
	}
	resolveInner(e, t = 0) {
		return pe(this, e, t, !0);
	}
	matchContext(e) {
		return _e(this.parent, e);
	}
	enterUnfinishedNodesBefore(e) {
		let t = this.childBefore(e), n = this;
		for (; t;) {
			let e = t.lastChild;
			if (!e || e.to != t.to) break;
			e.type.isError && e.from == e.to ? (n = t, t = e.prevSibling) : t = e;
		}
		return n;
	}
	get node() {
		return this;
	}
	get next() {
		return this.parent;
	}
}, he = class e extends me {
	constructor(e, t, n, r) {
		super(), this._tree = e, this.from = t, this.index = n, this._parent = r;
	}
	get type() {
		return this._tree.type;
	}
	get name() {
		return this._tree.type.name;
	}
	get to() {
		return this.from + this._tree.length;
	}
	nextChild(t, n, r, i, a = 0) {
		for (let o = this;;) {
			for (let { children: s, positions: c } = o._tree, l = n > 0 ? s.length : -1; t != l; t += n) {
				let l = s[t], u = c[t] + o.from, d;
				if (a & z.EnterBracketed && l instanceof le && (d = ie.get(l)) && !d.overlay && d.bracketed && r >= u && r <= u + l.length || fe(i, r, u, u + l.length)) {
					if (l instanceof de) {
						if (a & z.ExcludeBuffers) continue;
						let e = l.findChild(0, l.buffer.length, n, r - u, i);
						if (e > -1) return new ye(new ve(o, l, t, u), null, e);
					} else if (a & z.IncludeAnonymous || !l.type.isAnonymous || we(l)) {
						let s;
						if (!(a & z.IgnoreMounts) && (s = ie.get(l)) && !s.overlay) return new e(s.tree, u, t, o);
						let c = new e(l, u, t, o);
						return a & z.IncludeAnonymous || !c.type.isAnonymous ? c : c.nextChild(n < 0 ? l.children.length - 1 : 0, n, r, i, a);
					}
				}
			}
			if (a & z.IncludeAnonymous || !o.type.isAnonymous || (t = o.index >= 0 ? o.index + n : n < 0 ? -1 : o._parent._tree.children.length, o = o._parent, !o)) return null;
		}
	}
	get firstChild() {
		return this.nextChild(0, 1, 0, 4);
	}
	get lastChild() {
		return this.nextChild(this._tree.children.length - 1, -1, 0, 4);
	}
	childAfter(e) {
		return this.nextChild(0, 1, e, 2);
	}
	childBefore(e) {
		return this.nextChild(this._tree.children.length - 1, -1, e, -2);
	}
	prop(e) {
		return this._tree.prop(e);
	}
	enter(t, n, r = 0) {
		let i;
		if (!(r & z.IgnoreOverlays) && (i = ie.get(this._tree)) && i.overlay) {
			let a = t - this.from, o = r & z.EnterBracketed && i.bracketed;
			for (let { from: t, to: r } of i.overlay) if ((n > 0 || o ? t <= a : t < a) && (n < 0 || o ? r >= a : r > a)) return new e(i.tree, i.overlay[0].from + this.from, -1, this);
		}
		return this.nextChild(0, 1, t, n, r);
	}
	nextSignificantParent() {
		let e = this;
		for (; e.type.isAnonymous && e._parent;) e = e._parent;
		return e;
	}
	get parent() {
		return this._parent ? this._parent.nextSignificantParent() : null;
	}
	get nextSibling() {
		return this._parent && this.index >= 0 ? this._parent.nextChild(this.index + 1, 1, 0, 4) : null;
	}
	get prevSibling() {
		return this._parent && this.index >= 0 ? this._parent.nextChild(this.index - 1, -1, 0, 4) : null;
	}
	get tree() {
		return this._tree;
	}
	toTree() {
		return this._tree;
	}
	toString() {
		return this._tree.toString();
	}
};
function ge(e, t, n, r) {
	let i = e.cursor(), a = [];
	if (!i.firstChild()) return a;
	if (n != null) {
		for (let e = !1; !e;) if (e = i.type.is(n), !i.nextSibling()) return a;
	}
	for (;;) {
		if (r != null && i.type.is(r)) return a;
		if (i.type.is(t) && a.push(i.node), !i.nextSibling()) return r == null ? a : [];
	}
}
function _e(e, t, n = t.length - 1) {
	for (let r = e; n >= 0; r = r.parent) {
		if (!r) return !1;
		if (!r.type.isAnonymous) {
			if (t[n] && t[n] != r.name) return !1;
			n--;
		}
	}
	return !0;
}
var ve = class {
	constructor(e, t, n, r) {
		this.parent = e, this.buffer = t, this.index = n, this.start = r;
	}
}, ye = class e extends me {
	get name() {
		return this.type.name;
	}
	get from() {
		return this.context.start + this.context.buffer.buffer[this.index + 1];
	}
	get to() {
		return this.context.start + this.context.buffer.buffer[this.index + 2];
	}
	constructor(e, t, n) {
		super(), this.context = e, this._parent = t, this.index = n, this.type = e.buffer.set.types[e.buffer.buffer[n]];
	}
	child(t, n, r) {
		let { buffer: i } = this.context, a = i.findChild(this.index + 4, i.buffer[this.index + 3], t, n - this.context.start, r);
		return a < 0 ? null : new e(this.context, this, a);
	}
	get firstChild() {
		return this.child(1, 0, 4);
	}
	get lastChild() {
		return this.child(-1, 0, 4);
	}
	childAfter(e) {
		return this.child(1, e, 2);
	}
	childBefore(e) {
		return this.child(-1, e, -2);
	}
	prop(e) {
		return this.type.prop(e);
	}
	enter(t, n, r = 0) {
		if (r & z.ExcludeBuffers) return null;
		let { buffer: i } = this.context, a = i.findChild(this.index + 4, i.buffer[this.index + 3], n > 0 ? 1 : -1, t - this.context.start, n);
		return a < 0 ? null : new e(this.context, this, a);
	}
	get parent() {
		return this._parent || this.context.parent.nextSignificantParent();
	}
	externalSibling(e) {
		return this._parent ? null : this.context.parent.nextChild(this.context.index + e, e, 0, 4);
	}
	get nextSibling() {
		let { buffer: t } = this.context, n = t.buffer[this.index + 3];
		return n < (this._parent ? t.buffer[this._parent.index + 3] : t.buffer.length) ? new e(this.context, this._parent, n) : this.externalSibling(1);
	}
	get prevSibling() {
		let { buffer: t } = this.context, n = this._parent ? this._parent.index + 4 : 0;
		return this.index == n ? this.externalSibling(-1) : new e(this.context, this._parent, t.findChild(n, this.index, -1, 0, 4));
	}
	get tree() {
		return null;
	}
	toTree() {
		let e = [], t = [], { buffer: n } = this.context, r = this.index + 4, i = n.buffer[this.index + 3];
		if (i > r) {
			let a = n.buffer[this.index + 1];
			e.push(n.slice(r, i, a)), t.push(0);
		}
		return new le(this.type, e, t, this.to - this.from);
	}
	toString() {
		return this.context.buffer.childString(this.index);
	}
};
function be(e) {
	if (!e.length) return null;
	let t = 0, n = e[0];
	for (let r = 1; r < e.length; r++) {
		let i = e[r];
		(i.from > n.from || i.to < n.to) && (n = i, t = r);
	}
	let r = n instanceof he && n.index < 0 ? null : n.parent, i = e.slice();
	return r ? i[t] = r : i.splice(t, 1), new xe(i, n);
}
var xe = class {
	constructor(e, t) {
		this.heads = e, this.node = t;
	}
	get next() {
		return be(this.heads);
	}
};
function Se(e, t, n) {
	let r = e.resolveInner(t, n), i = null;
	for (let e = r instanceof he ? r : r.context.parent; e; e = e.parent) if (e.index < 0) {
		let a = e.parent;
		(i ||= [r]).push(a.resolve(t, n)), e = a;
	} else {
		let a = ie.get(e.tree);
		if (a && a.overlay && a.overlay[0].from <= t && a.overlay[a.overlay.length - 1].to >= t) {
			let o = new he(a.tree, a.overlay[0].from + e.from, -1, e);
			(i ||= [r]).push(pe(o, t, n, !1));
		}
	}
	return i ? be(i) : r;
}
var Ce = class {
	get name() {
		return this.type.name;
	}
	constructor(e, t = 0) {
		if (this.buffer = null, this.stack = [], this.index = 0, this.bufferNode = null, this.mode = t & ~z.EnterBracketed, e instanceof he) this.yieldNode(e);
		else {
			this._tree = e.context.parent, this.buffer = e.context;
			for (let t = e._parent; t; t = t._parent) this.stack.unshift(t.index);
			this.bufferNode = e, this.yieldBuf(e.index);
		}
	}
	yieldNode(e) {
		return e ? (this._tree = e, this.type = e.type, this.from = e.from, this.to = e.to, !0) : !1;
	}
	yieldBuf(e, t) {
		this.index = e;
		let { start: n, buffer: r } = this.buffer;
		return this.type = t || r.set.types[r.buffer[e]], this.from = n + r.buffer[e + 1], this.to = n + r.buffer[e + 2], !0;
	}
	yield(e) {
		return e ? e instanceof he ? (this.buffer = null, this.yieldNode(e)) : (this.buffer = e.context, this.yieldBuf(e.index, e.type)) : !1;
	}
	toString() {
		return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
	}
	enterChild(e, t, n) {
		if (!this.buffer) return this.yield(this._tree.nextChild(e < 0 ? this._tree._tree.children.length - 1 : 0, e, t, n, this.mode));
		let { buffer: r } = this.buffer, i = r.findChild(this.index + 4, r.buffer[this.index + 3], e, t - this.buffer.start, n);
		return i < 0 ? !1 : (this.stack.push(this.index), this.yieldBuf(i));
	}
	firstChild() {
		return this.enterChild(1, 0, 4);
	}
	lastChild() {
		return this.enterChild(-1, 0, 4);
	}
	childAfter(e) {
		return this.enterChild(1, e, 2);
	}
	childBefore(e) {
		return this.enterChild(-1, e, -2);
	}
	enter(e, t, n = this.mode) {
		return this.buffer ? n & z.ExcludeBuffers ? !1 : this.enterChild(1, e, t) : this.yield(this._tree.enter(e, t, n));
	}
	parent() {
		if (!this.buffer) return this.yieldNode(this.mode & z.IncludeAnonymous ? this._tree._parent : this._tree.parent);
		if (this.stack.length) return this.yieldBuf(this.stack.pop());
		let e = this.mode & z.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
		return this.buffer = null, this.yieldNode(e);
	}
	sibling(e) {
		if (!this.buffer) return this._tree._parent ? this.yield(this._tree.index < 0 ? null : this._tree._parent.nextChild(this._tree.index + e, e, 0, 4, this.mode)) : !1;
		let { buffer: t } = this.buffer, n = this.stack.length - 1;
		if (e < 0) {
			let e = n < 0 ? 0 : this.stack[n] + 4;
			if (this.index != e) return this.yieldBuf(t.findChild(e, this.index, -1, 0, 4));
		} else {
			let e = t.buffer[this.index + 3];
			if (e < (n < 0 ? t.buffer.length : t.buffer[this.stack[n] + 3])) return this.yieldBuf(e);
		}
		return n < 0 && this.yield(this.buffer.parent.nextChild(this.buffer.index + e, e, 0, 4, this.mode));
	}
	nextSibling() {
		return this.sibling(1);
	}
	prevSibling() {
		return this.sibling(-1);
	}
	atLastNode(e) {
		let t, n, { buffer: r } = this;
		if (r) {
			if (e > 0) {
				if (this.index < r.buffer.buffer.length) return !1;
			} else for (let e = 0; e < this.index; e++) if (r.buffer.buffer[e + 3] < this.index) return !1;
			({index: t, parent: n} = r);
		} else ({index: t, _parent: n} = this._tree);
		for (; n; {index: t, _parent: n} = n) if (t > -1) for (let r = t + e, i = e < 0 ? -1 : n._tree.children.length; r != i; r += e) {
			let e = n._tree.children[r];
			if (this.mode & z.IncludeAnonymous || e instanceof de || !e.type.isAnonymous || we(e)) return !1;
		}
		return !0;
	}
	move(e, t) {
		if (t && this.enterChild(e, 0, 4)) return !0;
		for (;;) {
			if (this.sibling(e)) return !0;
			if (this.atLastNode(e) || !this.parent()) return !1;
		}
	}
	next(e = !0) {
		return this.move(1, e);
	}
	prev(e = !0) {
		return this.move(-1, e);
	}
	moveTo(e, t = 0) {
		for (; (this.from == this.to || (t < 1 ? this.from >= e : this.from > e) || (t > -1 ? this.to <= e : this.to < e)) && this.parent(););
		for (; this.enterChild(1, e, t););
		return this;
	}
	get node() {
		if (!this.buffer) return this._tree;
		let e = this.bufferNode, t = null, n = 0;
		if (e && e.context == this.buffer) scan: for (let r = this.index, i = this.stack.length; i >= 0;) {
			for (let a = e; a; a = a._parent) if (a.index == r) {
				if (r == this.index) return a;
				t = a, n = i + 1;
				break scan;
			}
			r = this.stack[--i];
		}
		for (let e = n; e < this.stack.length; e++) t = new ye(this.buffer, t, this.stack[e]);
		return this.bufferNode = new ye(this.buffer, t, this.index);
	}
	get tree() {
		return this.buffer ? null : this._tree._tree;
	}
	iterate(e, t) {
		for (let n = 0;;) {
			let r = !1;
			if (this.type.isAnonymous || e(this) !== !1) {
				if (this.firstChild()) {
					n++;
					continue;
				}
				this.type.isAnonymous || (r = !0);
			}
			for (;;) {
				if (r && t && t(this), r = this.type.isAnonymous, !n) return;
				if (this.nextSibling()) break;
				this.parent(), n--, r = !0;
			}
		}
	}
	matchContext(e) {
		if (!this.buffer) return _e(this.node.parent, e);
		let { buffer: t } = this.buffer, { types: n } = t.set;
		for (let r = e.length - 1, i = this.stack.length - 1; r >= 0; i--) {
			if (i < 0) return _e(this._tree, e, r);
			let a = n[t.buffer[this.stack[i]]];
			if (!a.isAnonymous) {
				if (e[r] && e[r] != a.name) return !1;
				r--;
			}
		}
		return !0;
	}
};
function we(e) {
	return e.children.some((e) => e instanceof de || !e.type.isAnonymous || we(e));
}
function Te(e) {
	let { buffer: t, nodeSet: n, maxBufferLength: r = te, reused: i = [], minRepeatType: a = n.types.length } = e, o = Array.isArray(t) ? new ue(t, t.length) : t, s = n.types, c = 0, l = 0;
	function u(e, t, _, v, y, b) {
		let { id: x, start: S, end: C, size: w } = o, T = l, E = c;
		if (w < 0) {
			if (o.next(), w == -1) {
				let t = i[x];
				_.push(t), v.push(S - e);
				return;
			}
			if (w == -3) {
				c = x;
				return;
			}
			if (w == -4) {
				l = x;
				return;
			}
			throw RangeError(`Unrecognized record size: ${w}`);
		}
		let D = s[x], O, k, A = S - e;
		if (C - S <= r && (k = h(o.pos - t, y))) {
			let t = new Uint16Array(k.size - k.skip), r = o.pos - k.size, i = t.length;
			for (; o.pos > r;) i = g(k.start, t, i);
			O = new de(t, C - k.start, n), A = k.start - e;
		} else {
			let e = o.pos - w;
			o.next();
			let t = [], s = [], c = x >= a ? x : -1, h = 0, g = C, _ = T;
			for (; o.pos > e;) c >= 0 && o.id == c && o.size >= 0 ? (o.end <= g - r && (p(t, s, S, h, o.end, g, c, _, E), h = t.length, g = o.end, _ = l), o.next()) : b > 2500 ? d(S, e, t, s) : (c >= 0 && o.size == -1 && i[o.id].type == n.types[c] && (h < t.length && p(t, s, S, h, o.end, g, c, _, E), h = t.length + 1, g = o.start, _ = l), u(S, e, t, s, c, b + 1));
			if (c >= 0 && h > 0 && h < t.length && p(t, s, S, h, S, g, c, _, E), t.reverse(), s.reverse(), c > -1 && h > 0) {
				let e = f(D, E);
				O = Oe(D, t, s, 0, t.length, 0, C - S, e, e);
			} else O = m(D, t, s, C - S, T - C, E);
		}
		_.push(O), v.push(A);
	}
	function d(e, t, i, a) {
		let s = [], c = 0, l = -1;
		for (; o.pos > t;) {
			let { id: e, start: t, end: n, size: i } = o;
			if (i > 4) o.next();
			else if (l > -1 && t < l) break;
			else l < 0 && (l = n - r), s.push(e, t, n), c++, o.next();
		}
		if (c) {
			let t = new Uint16Array(c * 4), r = s[s.length - 2];
			for (let e = s.length - 3, n = 0; e >= 0; e -= 3) t[n++] = s[e], t[n++] = s[e + 1] - r, t[n++] = s[e + 2] - r, t[n++] = n;
			i.push(new de(t, s[2] - r, n)), a.push(r - e);
		}
	}
	function f(e, t) {
		return (n, r, i) => {
			let a = 0, o = n.length - 1, s, c;
			if (o >= 0 && (s = n[o]) instanceof le) {
				if (!o && s.type == e && s.length == i) return s;
				(c = s.prop(L.lookAhead)) && (a = r[o] + s.length + c - i);
			}
			return m(e, n, r, i, a, t);
		};
	}
	function p(e, t, r, i, a, o, s, c, l) {
		let u = [], d = [];
		for (; e.length > i;) u.push(e.pop()), d.push(t.pop() + r - a);
		e.push(m(n.types[s], u, d, o - a, c - o, l)), t.push(a - r);
	}
	function m(e, t, n, r, i, a, o) {
		if (a) {
			let e = [L.contextHash, a];
			o = o ? [e].concat(o) : [e];
		}
		if (i > 25) {
			let e = [L.lookAhead, i];
			o = o ? [e].concat(o) : [e];
		}
		return new le(e, t, n, r, o);
	}
	function h(e, t) {
		let n = o.fork(), i = 0, s = 0, c = 0, l = n.end - r, u = {
			size: 0,
			start: 0,
			skip: 0
		};
		scan: for (let r = n.pos - e; n.pos > r;) {
			let e = n.size;
			if (n.id == t && e >= 0) {
				u.size = i, u.start = s, u.skip = c, c += 4, i += 4, n.next();
				continue;
			}
			let o = n.pos - e;
			if (e < 0 || o < r || n.start < l) break;
			let d = n.id >= a ? 4 : 0, f = n.start;
			for (n.next(); n.pos > o;) {
				if (n.size < 0) {
					if (n.size == -3 || n.size == -4) d += 4;
					else break scan;
				} else n.id >= a && (d += 4);
				n.next();
			}
			s = f, i += e, c += d;
		}
		return (t < 0 || i == e) && (u.size = i, u.start = s, u.skip = c), u.size > 4 ? u : void 0;
	}
	function g(e, t, n) {
		let { id: r, start: i, end: s, size: u } = o;
		if (o.next(), u >= 0 && r < a) {
			let a = n;
			if (u > 4) {
				let r = o.pos - (u - 4);
				for (; o.pos > r;) n = g(e, t, n);
			}
			t[--n] = a, t[--n] = s - e, t[--n] = i - e, t[--n] = r;
		} else u == -3 ? c = r : u == -4 && (l = r);
		return n;
	}
	let _ = [], v = [];
	for (; o.pos > 0;) u(e.start || 0, e.bufferStart || 0, _, v, -1, 0);
	let y = e.length ?? (_.length ? v[0] + _[0].length : 0);
	return new le(s[e.topID], _.reverse(), v.reverse(), y);
}
var Ee = /* @__PURE__ */ new WeakMap();
function De(e, t) {
	if (!e.isAnonymous || t instanceof de || t.type != e) return 1;
	let n = Ee.get(t);
	if (n == null) {
		n = 1;
		for (let r of t.children) {
			if (r.type != e || !(r instanceof le)) {
				n = 1;
				break;
			}
			n += De(e, r);
		}
		Ee.set(t, n);
	}
	return n;
}
function Oe(e, t, n, r, i, a, o, s, c) {
	let l = 0;
	for (let n = r; n < i; n++) l += De(e, t[n]);
	let u = Math.ceil(l * 1.5 / 8), d = [], f = [];
	function p(t, n, r, i, o) {
		for (let s = r; s < i;) {
			let r = s, l = n[s], m = De(e, t[s]);
			for (s++; s < i; s++) {
				let n = De(e, t[s]);
				if (m + n >= u) break;
				m += n;
			}
			if (s == r + 1) {
				if (m > u) {
					let e = t[r];
					p(e.children, e.positions, 0, e.children.length, n[r] + o);
					continue;
				}
				d.push(t[r]);
			} else {
				let i = n[s - 1] + t[s - 1].length - l;
				d.push(Oe(e, t, n, r, s, l, i, null, c));
			}
			f.push(l + o - a);
		}
	}
	return p(t, n, r, i, 0), (s || c)(d, f, o);
}
var ke = class {
	startParse(e, t, n) {
		return typeof e == "string" && (e = new Ae(e)), n = n ? n.length ? n.map((e) => new re(e.from, e.to)) : [new re(0, 0)] : [new re(0, e.length)], this.createParse(e, t || [], n);
	}
	parse(e, t, n) {
		let r = this.startParse(e, t, n);
		for (;;) {
			let e = r.advance();
			if (e) return e;
		}
	}
}, Ae = class {
	constructor(e) {
		this.string = e;
	}
	get length() {
		return this.string.length;
	}
	chunk(e) {
		return this.string.slice(e);
	}
	get lineChunks() {
		return !1;
	}
	read(e, t) {
		return this.string.slice(e, t);
	}
};
new L({ perNode: !0 });
// ../../node_modules/@lezer/lr/dist/index.js
var je = class e {
	constructor(e, t, n, r, i, a, o, s, c, l = 0, u) {
		this.p = e, this.stack = t, this.state = n, this.reducePos = r, this.pos = i, this.score = a, this.buffer = o, this.bufferBase = s, this.curContext = c, this.lookAhead = l, this.parent = u;
	}
	toString() {
		return `[${this.stack.filter((e, t) => t % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
	}
	static start(t, n, r = 0) {
		let i = t.parser.context;
		return new e(t, [], n, r, r, 0, [], 0, i ? new Me(i, i.start) : null, 0, null);
	}
	get context() {
		return this.curContext ? this.curContext.context : null;
	}
	pushState(e, t) {
		this.stack.push(this.state, t, this.bufferBase + this.buffer.length), this.state = e;
	}
	reduce(e) {
		let t = e >> 19, n = e & 65535, { parser: r } = this.p, i = this.reducePos < this.pos - 25 && this.setLookAhead(this.pos), a = r.dynamicPrecedence(n);
		if (a && (this.score += a), t == 0) {
			n < r.minRepeatTerm && this.reducePos < this.pos && (this.reducePos = this.pos), this.pushState(r.getGoto(this.state, n, !0), this.reducePos), n < r.minRepeatTerm && this.storeNode(n, this.reducePos, this.reducePos, i ? 8 : 4, !0), this.reduceContext(n, this.reducePos);
			return;
		}
		let o = this.stack.length - (t - 1) * 3 - (e & 262144 ? 6 : 0), s = o ? this.stack[o - 2] : this.p.ranges[0].from;
		n < r.minRepeatTerm && s == this.reducePos && this.reducePos < this.pos && (this.reducePos = this.pos);
		let c = this.reducePos - s;
		c >= 2e3 && !this.p.parser.nodeSet.types[n]?.isAnonymous && (s == this.p.lastBigReductionStart ? (this.p.bigReductionCount++, this.p.lastBigReductionSize = c) : this.p.lastBigReductionSize < c && (this.p.bigReductionCount = 1, this.p.lastBigReductionStart = s, this.p.lastBigReductionSize = c));
		let l = o ? this.stack[o - 1] : 0, u = this.bufferBase + this.buffer.length - l;
		if (n < r.minRepeatTerm || e & 131072) {
			let e = r.stateFlag(this.state, 1) ? this.pos : this.reducePos;
			this.storeNode(n, s, e, u + 4, !0);
		}
		if (e & 262144) this.state = this.stack[o];
		else {
			let e = this.stack[o - 3];
			this.state = r.getGoto(e, n, !0);
		}
		for (; this.stack.length > o;) this.stack.pop();
		this.reduceContext(n, s);
	}
	storeNode(e, t, n, r = 4, i = !1) {
		if (e == 0 && (!this.stack.length || this.stack[this.stack.length - 1] < this.buffer.length + this.bufferBase)) {
			let e = this.buffer.length;
			if (e > 0 && this.buffer[e - 4] == 0 && this.buffer[e - 1] > -1) {
				if (t == n) return;
				if (this.buffer[e - 2] >= t) {
					this.buffer[e - 2] = n;
					return;
				}
			}
		}
		if (!i || this.pos == n) this.buffer.push(e, t, n, r);
		else {
			let i = this.buffer.length;
			if (i > 0 && (this.buffer[i - 4] != 0 || this.buffer[i - 1] < 0)) {
				let e = !1;
				for (let t = i; t > 0 && this.buffer[t - 2] > n; t -= 4) if (this.buffer[t - 1] >= 0) {
					e = !0;
					break;
				}
				if (e) for (; i > 0 && this.buffer[i - 2] > n;) this.buffer[i] = this.buffer[i - 4], this.buffer[i + 1] = this.buffer[i - 3], this.buffer[i + 2] = this.buffer[i - 2], this.buffer[i + 3] = this.buffer[i - 1], i -= 4, r > 4 && (r -= 4);
			}
			this.buffer[i] = e, this.buffer[i + 1] = t, this.buffer[i + 2] = n, this.buffer[i + 3] = r;
		}
	}
	shift(e, t, n, r) {
		if (e & 131072) this.pushState(e & 65535, this.pos);
		else if (e & 262144) this.pos = r, this.shiftContext(t, n), t <= this.p.parser.maxNode && this.buffer.push(t, n, r, 4);
		else {
			let i = e, { parser: a } = this.p;
			this.pos = r;
			let o = a.stateFlag(i, 1);
			!o && (r > n || t <= a.maxNode) && (this.reducePos = r), this.pushState(i, o ? n : Math.min(n, this.reducePos)), this.shiftContext(t, n), t <= a.maxNode && this.buffer.push(t, n, r, 4);
		}
	}
	apply(e, t, n, r) {
		e & 65536 ? this.reduce(e) : this.shift(e, t, n, r);
	}
	useNode(e, t, n) {
		let r = this.p.reused.length - 1;
		(r < 0 || this.p.reused[r] != e) && (this.p.reused.push(e), r++);
		let i = this.reducePos = this.pos = n + e.length;
		this.pushState(t, n), this.buffer.push(r, n, i, -1), this.curContext && this.updateContext(this.curContext.tracker.reuse(this.curContext.context, e, this, this.p.stream.reset(this.pos - e.length)));
	}
	split() {
		let t = this, n = t.buffer.length;
		for (n && t.buffer[n - 4] == 0 && (n -= 4); n > 0 && t.buffer[n - 2] > t.reducePos;) n -= 4;
		let r = t.buffer.slice(n), i = t.bufferBase + n;
		for (; t && i == t.bufferBase;) t = t.parent;
		return new e(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, r, i, this.curContext, this.lookAhead, t);
	}
	recoverByDelete(e, t) {
		let n = e <= this.p.parser.maxNode;
		n && this.storeNode(e, this.pos, t, 4), this.storeNode(0, this.pos, t, n ? 8 : 4), this.pos = this.reducePos = t, this.score -= 190;
	}
	canShift(e) {
		for (let t = new Ne(this);;) {
			let n = this.p.parser.stateSlot(t.state, 4) || this.p.parser.hasAction(t.state, e);
			if (n == 0) return !1;
			if (!(n & 65536)) return !0;
			t.reduce(n);
		}
	}
	recoverByInsert(e) {
		if (this.stack.length >= 300) return [];
		let t = this.p.parser.nextStates(this.state);
		if (t.length > 8 || this.stack.length >= 120) {
			let n = [];
			for (let r = 0, i; r < t.length; r += 2) (i = t[r + 1]) != this.state && this.p.parser.hasAction(i, e) && n.push(t[r], i);
			if (this.stack.length < 120) for (let e = 0; n.length < 8 && e < t.length; e += 2) {
				let r = t[e + 1];
				n.some((e, t) => t & 1 && e == r) || n.push(t[e], r);
			}
			t = n;
		}
		let n = [];
		for (let e = 0; e < t.length && n.length < 4; e += 2) {
			let r = t[e + 1];
			if (r == this.state) continue;
			let i = this.split();
			i.pushState(r, this.pos), i.storeNode(0, i.pos, i.pos, 4, !0), i.shiftContext(t[e], this.pos), i.reducePos = this.pos, i.score -= 200, n.push(i);
		}
		return n;
	}
	forceReduce() {
		let { parser: e } = this.p, t = e.stateSlot(this.state, 5);
		if (!(t & 65536)) return !1;
		if (!e.validAction(this.state, t)) {
			let n = t >> 19, r = t & 65535, i = this.stack.length - n * 3;
			if (i < 0 || e.getGoto(this.stack[i], r, !1) < 0) {
				let e = this.findForcedReduction();
				if (e == null) return !1;
				t = e;
			}
			this.storeNode(0, this.pos, this.pos, 4, !0), this.score -= 100;
		}
		return this.reducePos = this.pos, this.reduce(t), !0;
	}
	findForcedReduction() {
		let { parser: e } = this.p, t = [], n = (r, i) => {
			if (!t.includes(r)) return t.push(r), e.allActions(r, (t) => {
				if (!(t & 393216)) {
					if (t & 65536) {
						let n = (t >> 19) - i;
						if (n > 1) {
							let r = t & 65535, i = this.stack.length - n * 3;
							if (i >= 0 && e.getGoto(this.stack[i], r, !1) >= 0) return n << 19 | 65536 | r;
						}
					} else {
						let e = n(t, i + 1);
						if (e != null) return e;
					}
				}
			});
		};
		return n(this.state, 0);
	}
	forceAll() {
		for (; !this.p.parser.stateFlag(this.state, 2);) if (!this.forceReduce()) {
			this.storeNode(0, this.pos, this.pos, 4, !0);
			break;
		}
		return this;
	}
	get deadEnd() {
		if (this.stack.length != 3) return !1;
		let { parser: e } = this.p;
		return e.data[e.stateSlot(this.state, 1)] == 65535 && !e.stateSlot(this.state, 4);
	}
	restart() {
		this.storeNode(0, this.pos, this.pos, 4, !0), this.state = this.stack[0], this.stack.length = 0;
	}
	sameState(e) {
		if (this.state != e.state || this.stack.length != e.stack.length) return !1;
		for (let t = 0; t < this.stack.length; t += 3) if (this.stack[t] != e.stack[t]) return !1;
		return !0;
	}
	get parser() {
		return this.p.parser;
	}
	dialectEnabled(e) {
		return this.p.parser.dialect.flags[e];
	}
	shiftContext(e, t) {
		this.curContext && this.updateContext(this.curContext.tracker.shift(this.curContext.context, e, this, this.p.stream.reset(t)));
	}
	reduceContext(e, t) {
		this.curContext && this.updateContext(this.curContext.tracker.reduce(this.curContext.context, e, this, this.p.stream.reset(t)));
	}
	emitContext() {
		let e = this.buffer.length - 1;
		(e < 0 || this.buffer[e] != -3) && this.storeNode(this.curContext.hash, this.reducePos, this.reducePos, -3, !0);
	}
	emitLookAhead() {
		let e = this.buffer.length - 1;
		(e < 0 || this.buffer[e] != -4) && this.buffer.push(this.lookAhead, this.pos, this.pos, -4);
	}
	updateContext(e) {
		if (e != this.curContext.context) {
			let t = new Me(this.curContext.tracker, e);
			t.hash != this.curContext.hash && this.emitContext(), this.curContext = t;
		}
	}
	setLookAhead(e) {
		return e <= this.lookAhead ? !1 : (this.emitLookAhead(), this.lookAhead = e, !0);
	}
	close() {
		this.curContext && this.curContext.tracker.strict && this.emitContext(), this.lookAhead > 0 && this.emitLookAhead();
	}
}, Me = class {
	constructor(e, t) {
		this.tracker = e, this.context = t, this.hash = e.strict ? e.hash(t) : 0;
	}
}, Ne = class {
	constructor(e) {
		this.start = e, this.state = e.state, this.stack = e.stack, this.base = this.stack.length;
	}
	reduce(e) {
		let t = e & 65535, n = e >> 19;
		n == 0 ? (this.stack == this.start.stack && (this.stack = this.stack.slice()), this.stack.push(this.state, 0, 0), this.base += 3) : this.base -= (n - 1) * 3;
		let r = this.start.p.parser.getGoto(this.stack[this.base - 3], t, !0);
		this.state = r;
	}
}, Pe = class e {
	constructor(e, t, n) {
		this.stack = e, this.pos = t, this.index = n, this.buffer = e.buffer, this.index == 0 && this.maybeNext();
	}
	static create(t, n = t.bufferBase + t.buffer.length) {
		return new e(t, n, n - t.bufferBase);
	}
	maybeNext() {
		let e = this.stack.parent;
		e != null && (this.index = this.stack.bufferBase - e.bufferBase, this.stack = e, this.buffer = e.buffer);
	}
	get id() {
		return this.buffer[this.index - 4];
	}
	get start() {
		return this.buffer[this.index - 3];
	}
	get end() {
		return this.buffer[this.index - 2];
	}
	get size() {
		return this.buffer[this.index - 1];
	}
	next() {
		this.index -= 4, this.pos -= 4, this.index == 0 && this.maybeNext();
	}
	fork() {
		return new e(this.stack, this.pos, this.index);
	}
};
function Fe(e, t = Uint16Array) {
	if (typeof e != "string") return e;
	let n = null;
	for (let r = 0, i = 0; r < e.length;) {
		let a = 0;
		for (;;) {
			let t = e.charCodeAt(r++), n = !1;
			if (t == 126) {
				a = 65535;
				break;
			}
			t >= 92 && t--, t >= 34 && t--;
			let i = t - 32;
			if (i >= 46 && (i -= 46, n = !0), a += i, n) break;
			a *= 46;
		}
		n ? n[i++] = a : n = new t(a);
	}
	return n;
}
var Ie = class {
	constructor() {
		this.start = -1, this.value = -1, this.end = -1, this.extended = -1, this.lookAhead = 0, this.mask = 0, this.context = 0;
	}
}, Le = new Ie(), Re = class {
	constructor(e, t) {
		this.input = e, this.ranges = t, this.chunk = "", this.chunkOff = 0, this.chunk2 = "", this.chunk2Pos = 0, this.next = -1, this.token = Le, this.rangeIndex = 0, this.pos = this.chunkPos = t[0].from, this.range = t[0], this.end = t[t.length - 1].to, this.readNext();
	}
	resolveOffset(e, t) {
		let n = this.range, r = this.rangeIndex, i = this.pos + e;
		for (; i < n.from;) {
			if (!r) return null;
			let e = this.ranges[--r];
			i -= n.from - e.to, n = e;
		}
		for (; t < 0 ? i > n.to : i >= n.to;) {
			if (r == this.ranges.length - 1) return null;
			let e = this.ranges[++r];
			i += e.from - n.to, n = e;
		}
		return i;
	}
	clipPos(e) {
		if (e >= this.range.from && e < this.range.to) return e;
		for (let t of this.ranges) if (t.to > e) return Math.max(e, t.from);
		return this.end;
	}
	peek(e) {
		let t = this.chunkOff + e, n, r;
		if (t >= 0 && t < this.chunk.length) n = this.pos + e, r = this.chunk.charCodeAt(t);
		else {
			let t = this.resolveOffset(e, 1);
			if (t == null) return -1;
			if (n = t, n >= this.chunk2Pos && n < this.chunk2Pos + this.chunk2.length) r = this.chunk2.charCodeAt(n - this.chunk2Pos);
			else {
				let e = this.rangeIndex, t = this.range;
				for (; t.to <= n;) t = this.ranges[++e];
				this.chunk2 = this.input.chunk(this.chunk2Pos = n), n + this.chunk2.length > t.to && (this.chunk2 = this.chunk2.slice(0, t.to - n)), r = this.chunk2.charCodeAt(0);
			}
		}
		return n >= this.token.lookAhead && (this.token.lookAhead = n + 1), r;
	}
	acceptToken(e, t = 0) {
		let n = t ? this.resolveOffset(t, -1) : this.pos;
		if (n == null || n < this.token.start) throw RangeError("Token end out of bounds");
		this.token.value = e, this.token.end = n;
	}
	acceptTokenTo(e, t) {
		this.token.value = e, this.token.end = t;
	}
	getChunk() {
		if (this.pos >= this.chunk2Pos && this.pos < this.chunk2Pos + this.chunk2.length) {
			let { chunk: e, chunkPos: t } = this;
			this.chunk = this.chunk2, this.chunkPos = this.chunk2Pos, this.chunk2 = e, this.chunk2Pos = t, this.chunkOff = this.pos - this.chunkPos;
		} else {
			this.chunk2 = this.chunk, this.chunk2Pos = this.chunkPos;
			let e = this.input.chunk(this.pos), t = this.pos + e.length;
			this.chunk = t > this.range.to ? e.slice(0, this.range.to - this.pos) : e, this.chunkPos = this.pos, this.chunkOff = 0;
		}
	}
	readNext() {
		return this.next = this.chunkOff >= this.chunk.length && (this.getChunk(), this.chunkOff == this.chunk.length) ? -1 : this.chunk.charCodeAt(this.chunkOff);
	}
	advance(e = 1) {
		for (this.chunkOff += e; this.pos + e >= this.range.to;) {
			if (this.rangeIndex == this.ranges.length - 1) return this.setDone();
			e -= this.range.to - this.pos, this.range = this.ranges[++this.rangeIndex], this.pos = this.range.from;
		}
		return this.pos += e, this.pos >= this.token.lookAhead && (this.token.lookAhead = this.pos + 1), this.readNext();
	}
	setDone() {
		return this.pos = this.chunkPos = this.end, this.range = this.ranges[this.rangeIndex = this.ranges.length - 1], this.chunk = "", this.next = -1;
	}
	reset(e, t) {
		if (t ? (this.token = t, t.start = e, t.lookAhead = e + 1, t.value = t.extended = -1) : this.token = Le, this.pos != e) {
			if (this.pos = e, e == this.end) return this.setDone(), this;
			for (; e < this.range.from;) this.range = this.ranges[--this.rangeIndex];
			for (; e >= this.range.to;) this.range = this.ranges[++this.rangeIndex];
			e >= this.chunkPos && e < this.chunkPos + this.chunk.length ? this.chunkOff = e - this.chunkPos : (this.chunk = "", this.chunkOff = 0), this.readNext();
		}
		return this;
	}
	read(e, t) {
		if (e >= this.chunkPos && t <= this.chunkPos + this.chunk.length) return this.chunk.slice(e - this.chunkPos, t - this.chunkPos);
		if (e >= this.chunk2Pos && t <= this.chunk2Pos + this.chunk2.length) return this.chunk2.slice(e - this.chunk2Pos, t - this.chunk2Pos);
		if (e >= this.range.from && t <= this.range.to) return this.input.read(e, t);
		let n = "";
		for (let r of this.ranges) {
			if (r.from >= t) break;
			r.to > e && (n += this.input.read(Math.max(r.from, e), Math.min(r.to, t)));
		}
		return n;
	}
}, ze = class {
	constructor(e, t) {
		this.data = e, this.id = t;
	}
	token(e, t) {
		let { parser: n } = t.p;
		Ve(this.data, e, t, this.id, n.data, n.tokenPrecTable);
	}
};
ze.prototype.contextual = ze.prototype.fallback = ze.prototype.extend = !1;
var Be = class {
	constructor(e, t, n) {
		this.precTable = t, this.elseToken = n, this.data = typeof e == "string" ? Fe(e) : e;
	}
	token(e, t) {
		let n = e.pos, r = 0;
		for (;;) {
			let n = e.next < 0, i = e.resolveOffset(1, 1);
			if (Ve(this.data, e, t, 0, this.data, this.precTable), e.token.value > -1) break;
			if (this.elseToken == null) return;
			if (n || r++, i == null) break;
			e.reset(i, e.token);
		}
		r && (e.reset(n, e.token), e.acceptToken(this.elseToken, r));
	}
};
Be.prototype.contextual = ze.prototype.fallback = ze.prototype.extend = !1;
function Ve(e, t, n, r, i, a) {
	let o = 0, s = 1 << r, { dialect: c } = n.p.parser;
	scan: for (; (s & e[o]) != 0;) {
		let n = e[o + 1];
		for (let r = o + 3; r < n; r += 2) if ((e[r + 1] & s) > 0) {
			let n = e[r];
			if (c.allows(n) && (t.token.value == -1 || t.token.value == n || Ue(n, t.token.value, i, a))) {
				t.acceptToken(n);
				break;
			}
		}
		let r = t.next, l = 0, u = e[o + 2];
		if (t.next < 0 && u > l && e[n + u * 3 - 3] == 65535) {
			o = e[n + u * 3 - 1];
			continue scan;
		}
		for (; l < u;) {
			let i = l + u >> 1, a = n + i + (i << 1), s = e[a], c = e[a + 1] || 65536;
			if (r < s) u = i;
			else if (r >= c) l = i + 1;
			else {
				o = e[a + 2], t.advance();
				continue scan;
			}
		}
		break;
	}
}
function He(e, t, n) {
	for (let r = t, i; (i = e[r]) != 65535; r++) if (i == n) return r - t;
	return -1;
}
function Ue(e, t, n, r) {
	let i = He(n, r, t);
	return i < 0 || He(n, r, e) < i;
}
var We = typeof process < "u" && process.env && /\bparse\b/.test(process.env.LOG), Ge = null;
function Ke(e, t, n) {
	let r = e.cursor(z.IncludeAnonymous);
	for (r.moveTo(t);;) if (!(n < 0 ? r.childBefore(t) : r.childAfter(t))) for (;;) {
		if ((n < 0 ? r.to < t : r.from > t) && !r.type.isError) return n < 0 ? Math.max(0, Math.min(r.to - 1, t - 25)) : Math.min(e.length, Math.max(r.from + 1, t + 25));
		if (n < 0 ? r.prevSibling() : r.nextSibling()) break;
		if (!r.parent()) return n < 0 ? 0 : e.length;
	}
}
var qe = class {
	constructor(e, t) {
		this.fragments = e, this.minRepeat = t, this.i = 0, this.fragment = null, this.safeFrom = -1, this.safeTo = -1, this.trees = [], this.start = [], this.index = [], this.lastRepeat = null, this.lastRepeatPos = -1, this.nextFragment();
	}
	nextFragment() {
		let e = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
		if (e) {
			for (this.safeFrom = e.openStart ? Ke(e.tree, e.from + e.offset, 1) - e.offset : e.from, this.safeTo = e.openEnd ? Ke(e.tree, e.to + e.offset, -1) - e.offset : e.to; this.trees.length;) this.trees.pop(), this.start.pop(), this.index.pop();
			this.trees.push(e.tree), this.start.push(-e.offset), this.index.push(0), this.nextStart = this.safeFrom;
		} else this.nextStart = 1e9;
	}
	nodeAt(e) {
		if (e < this.nextStart) return null;
		for (; this.fragment && this.safeTo <= e;) this.nextFragment();
		if (!this.fragment) return null;
		for (;;) {
			let t = this.trees.length - 1;
			if (t < 0) return this.nextFragment(), null;
			if (e < this.safeFrom) return null;
			let n = this.trees[t], r = this.index[t];
			if (r == n.children.length) {
				this.trees.pop(), this.start.pop(), this.index.pop();
				continue;
			}
			let i = n.children[r], a = this.start[t] + n.positions[r];
			if (a > e) return this.nextStart = a, null;
			if (i instanceof le) {
				let n = a > this.lastRepeatPos && i.type.id >= this.minRepeat;
				if (a == e || n) {
					let t = a + i.length, r;
					if (a >= this.safeFrom && t <= this.safeTo && (!(r = i.prop(L.lookAhead)) || t + r < this.fragment.to) && (n && (this.lastRepeat = i, this.lastRepeatPos = a), a == e)) return i;
				}
				this.index[t]++, a + i.length >= Math.max(this.safeFrom, e) && (this.trees.push(i), this.start.push(a), this.index.push(0));
			} else this.index[t]++, this.nextStart = a + i.length;
		}
	}
}, Je = class {
	constructor(e, t) {
		this.stream = t, this.tokens = [], this.mainToken = null, this.actions = [], this.tokens = e.tokenizers.map((e) => new Ie());
	}
	getActions(e) {
		let t = 0, n = null, { parser: r } = e.p, { tokenizers: i } = r, a = r.stateSlot(e.state, 3), o = e.curContext ? e.curContext.hash : 0, s = 0;
		for (let r = 0; r < i.length; r++) {
			if (!(1 << r & a)) continue;
			let c = i[r], l = this.tokens[r];
			if ((!n || c.fallback) && ((c.contextual || l.start != e.pos || l.mask != a || l.context != o) && (this.updateCachedToken(l, c, e), l.mask = a, l.context = o), l.lookAhead > l.end + 25 && (s = Math.max(l.lookAhead, s)), l.value != 0)) {
				let r = t;
				if (l.extended > -1 && (t = this.addActions(e, l.extended, l.end, t)), t = this.addActions(e, l.value, l.end, t), !c.extend && (n = l, t > r)) break;
			}
		}
		for (; this.actions.length > t;) this.actions.pop();
		return s && e.setLookAhead(s), !n && e.pos == this.stream.end && (n = new Ie(), n.value = e.p.parser.eofTerm, n.start = n.end = e.pos, t = this.addActions(e, n.value, n.end, t)), this.mainToken = n, this.actions;
	}
	getMainToken(e) {
		if (this.mainToken) return this.mainToken;
		let t = new Ie(), { pos: n, p: r } = e;
		return t.start = n, t.end = Math.min(n + 1, r.stream.end), t.value = n == r.stream.end ? r.parser.eofTerm : 0, t;
	}
	updateCachedToken(e, t, n) {
		let r = this.stream.clipPos(n.pos);
		if (t.token(this.stream.reset(r, e), n), e.value > -1) {
			let { parser: t } = n.p;
			for (let r = 0; r < t.specialized.length; r++) if (t.specialized[r] == e.value) {
				let i = t.specializers[r](this.stream.read(e.start, e.end), n);
				if (i >= 0 && n.p.parser.dialect.allows(i >> 1)) {
					i & 1 ? e.extended = i >> 1 : e.value = i >> 1;
					break;
				}
			}
		} else e.value = 0, e.end = this.stream.clipPos(r + 1);
	}
	putAction(e, t, n, r) {
		for (let t = 0; t < r; t += 3) if (this.actions[t] == e) return r;
		return this.actions[r++] = e, this.actions[r++] = t, this.actions[r++] = n, r;
	}
	addActions(e, t, n, r) {
		let { state: i } = e, { parser: a } = e.p, { data: o } = a;
		for (let e = 0; e < 2; e++) for (let s = a.stateSlot(i, e ? 2 : 1);; s += 3) {
			if (o[s] == 65535) {
				if (o[s + 1] == 1) s = $e(o, s + 2);
				else {
					r == 0 && o[s + 1] == 2 && (r = this.putAction($e(o, s + 2), t, n, r));
					break;
				}
			}
			o[s] == t && (r = this.putAction($e(o, s + 1), t, n, r));
		}
		return r;
	}
}, Ye = class {
	constructor(e, t, n, r) {
		this.parser = e, this.input = t, this.ranges = r, this.recovering = 0, this.nextStackID = 9812, this.minStackPos = 0, this.reused = [], this.stoppedAt = null, this.lastBigReductionStart = -1, this.lastBigReductionSize = 0, this.bigReductionCount = 0, this.stream = new Re(t, r), this.tokens = new Je(e, this.stream), this.topTerm = e.top[1];
		let { from: i } = r[0];
		this.stacks = [je.start(this, e.top[0], i)], this.fragments = n.length && this.stream.end - i > e.bufferLength * 4 ? new qe(n, e.minRepeatTerm) : null;
	}
	get parsedPos() {
		return this.minStackPos;
	}
	advance() {
		let e = this.stacks, t = this.minStackPos, n = this.stacks = [], r, i;
		if (this.bigReductionCount > 300 && e.length == 1) {
			let [t] = e;
			for (; t.forceReduce() && t.stack.length && t.stack[t.stack.length - 2] >= this.lastBigReductionStart;);
			this.bigReductionCount = this.lastBigReductionSize = 0;
		}
		for (let a = 0; a < e.length; a++) {
			let o = e[a];
			for (;;) {
				if (this.tokens.mainToken = null, o.pos > t) n.push(o);
				else if (this.advanceStack(o, n, e)) continue;
				else {
					r || (r = [], i = []), r.push(o);
					let e = this.tokens.getMainToken(o);
					i.push(e.value, e.end);
				}
				break;
			}
		}
		if (!n.length) {
			let e = r && et(r);
			if (e) return We && console.log("Finish with " + this.stackID(e)), this.stackToTree(e);
			if (this.parser.strict) throw We && r && console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none")), SyntaxError("No parse at " + t);
			this.recovering ||= 5;
		}
		if (this.recovering && r) {
			let e = this.stoppedAt != null && r[0].pos > this.stoppedAt ? r[0] : this.runRecovery(r, i, n);
			if (e) return We && console.log("Force-finish " + this.stackID(e)), this.stackToTree(e.forceAll());
		}
		if (this.recovering) {
			let e = this.recovering == 1 ? 1 : this.recovering * 3;
			if (n.length > e) for (n.sort((e, t) => t.score - e.score); n.length > e;) n.pop();
			n.some((e) => e.reducePos > t) && this.recovering--;
		} else if (n.length > 1) {
			outer: for (let e = 0; e < n.length - 1; e++) {
				let t = n[e];
				for (let r = e + 1; r < n.length; r++) {
					let i = n[r];
					if (t.sameState(i) || t.buffer.length > 500 && i.buffer.length > 500) {
						if ((t.score - i.score || t.buffer.length - i.buffer.length) > 0) n.splice(r--, 1);
						else {
							n.splice(e--, 1);
							continue outer;
						}
					}
				}
			}
			n.length > 12 && (n.sort((e, t) => t.score - e.score), n.splice(12, n.length - 12));
		}
		this.minStackPos = n[0].pos;
		for (let e = 1; e < n.length; e++) n[e].pos < this.minStackPos && (this.minStackPos = n[e].pos);
		return null;
	}
	stopAt(e) {
		if (this.stoppedAt != null && this.stoppedAt < e) throw RangeError("Can't move stoppedAt forward");
		this.stoppedAt = e;
	}
	tryReuse(e, t, n, r) {
		if (!n) return null;
		let i = e.curContext && e.curContext.tracker.strict, a = i ? e.curContext.hash : 0;
		for (; n;) {
			let o = this.parser.nodeSet.types[n.type.id] == n.type ? this.parser.getGoto(e.state, n.type.id) : -1;
			if (o > -1 && n.length && (!i || (n.prop(L.contextHash) || 0) == a)) return e.useNode(n, o, t), n;
			if (n.children.length == 0 || n.positions[0] > 0) break;
			let s = n.children[0];
			if (s instanceof le && (!r || s.type.id >= this.parser.minRepeatTerm)) n = s;
			else break;
		}
		return null;
	}
	advanceStack(e, t, n) {
		let r = e.pos, { parser: i } = this, a = We ? this.stackID(e) + " -> " : "";
		if (this.stoppedAt != null && r > this.stoppedAt) return e.forceReduce() ? e : null;
		if (this.fragments) {
			let t = e.reducePos < r && e.buffer.length && e.buffer[e.buffer.length - 2] <= e.reducePos && this.fragments.lastRepeatPos == e.reducePos && this.tryReuse(e, e.reducePos, this.fragments.lastRepeat, !0) || this.tryReuse(e, r, this.fragments.nodeAt(r), !1);
			if (t) return We && console.log(a + this.stackID(e) + ` (via reuse of ${i.getName(t.type.id)})`), !0;
		}
		let o = i.stateSlot(e.state, 4);
		if (o > 0) return e.reduce(o), We && console.log(a + this.stackID(e) + ` (via always-reduce ${i.getName(o & 65535)})`), !0;
		if (e.stack.length >= 8400) for (; e.stack.length > 6e3 && e.forceReduce(););
		let s = this.tokens.getActions(e);
		for (let o = 0; o < s.length;) {
			let c = s[o++], l = s[o++], u = s[o++], d = o == s.length || !n, f = d ? e : e.split(), p = this.tokens.mainToken;
			if (f.apply(c, l, p ? p.start : f.pos, u), We && console.log(a + this.stackID(f) + ` (via ${c & 65536 ? `reduce of ${i.getName(c & 65535)}` : "shift"} for ${i.getName(l)} @ ${r}${f == e ? "" : ", split"})`), d) return !0;
			f.pos > r ? t.push(f) : n.push(f);
		}
		return !1;
	}
	advanceFully(e, t) {
		let n = e.pos;
		for (;;) {
			if (!this.advanceStack(e, null, null)) return !1;
			if (e.pos > n) return Xe(e, t), !0;
		}
	}
	runRecovery(e, t, n) {
		let r = null, i = !1;
		for (let a = 0; a < e.length; a++) {
			let o = e[a], s = t[a << 1], c = t[(a << 1) + 1], l = We ? this.stackID(o) + " -> " : "";
			if (o.deadEnd && (i || (i = !0, o.restart(), We && console.log(l + this.stackID(o) + " (restarted)"), this.advanceFully(o, n)))) continue;
			let u = o.split(), d = l;
			for (let e = 0; e < 10 && u.forceReduce() && (We && console.log(d + this.stackID(u) + " (via force-reduce)"), !this.advanceFully(u, n)); e++) We && (d = this.stackID(u) + " -> ");
			for (let e of o.recoverByInsert(s)) We && console.log(l + this.stackID(e) + " (via recover-insert)"), this.advanceFully(e, n);
			this.stream.end > o.pos ? (c == o.pos && (c++, s = 0), o.recoverByDelete(s, c), We && console.log(l + this.stackID(o) + ` (via recover-delete ${this.parser.getName(s)})`), Xe(o, n)) : (!r || r.score < u.score) && (r = u);
		}
		return r;
	}
	stackToTree(e) {
		return e.close(), le.build({
			buffer: Pe.create(e),
			nodeSet: this.parser.nodeSet,
			topID: this.topTerm,
			maxBufferLength: this.parser.bufferLength,
			reused: this.reused,
			start: this.ranges[0].from,
			length: e.pos - this.ranges[0].from,
			minRepeatType: this.parser.minRepeatTerm
		});
	}
	stackID(e) {
		let t = (Ge ||= /* @__PURE__ */ new WeakMap()).get(e);
		return t || Ge.set(e, t = String.fromCodePoint(this.nextStackID++)), t + e;
	}
};
function Xe(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (r.pos == e.pos && r.sameState(e)) {
			t[n].score < e.score && (t[n] = e);
			return;
		}
	}
	t.push(e);
}
var Ze = class {
	constructor(e, t, n) {
		this.source = e, this.flags = t, this.disabled = n;
	}
	allows(e) {
		return !this.disabled || this.disabled[e] == 0;
	}
}, Qe = class e extends ke {
	constructor(e) {
		if (super(), this.wrappers = [], e.version != 14) throw RangeError(`Parser version (${e.version}) doesn't match runtime version (14)`);
		let t = e.nodeNames.split(" ");
		this.minRepeatTerm = t.length;
		for (let n = 0; n < e.repeatNodeCount; n++) t.push("");
		let n = Object.keys(e.topRules).map((t) => e.topRules[t][1]), r = [];
		for (let e = 0; e < t.length; e++) r.push([]);
		function i(e, t, n) {
			r[e].push([t, t.deserialize(String(n))]);
		}
		if (e.nodeProps) for (let t of e.nodeProps) {
			let e = t[0];
			typeof e == "string" && (e = L[e]);
			for (let n = 1; n < t.length;) {
				let r = t[n++];
				if (r >= 0) i(r, e, t[n++]);
				else {
					let a = t[n + -r];
					for (let o = -r; o > 0; o--) i(t[n++], e, a);
					n++;
				}
			}
		}
		this.nodeSet = new oe(t.map((t, i) => R.define({
			name: i >= this.minRepeatTerm ? void 0 : t,
			id: i,
			props: r[i],
			top: n.indexOf(i) > -1,
			error: i == 0,
			skipped: e.skippedNodes && e.skippedNodes.indexOf(i) > -1
		}))), e.propSources && (this.nodeSet = this.nodeSet.extend(...e.propSources)), this.strict = !1, this.bufferLength = te;
		let a = Fe(e.tokenData);
		this.context = e.context, this.specializerSpecs = e.specialized || [], this.specialized = new Uint16Array(this.specializerSpecs.length);
		for (let e = 0; e < this.specializerSpecs.length; e++) this.specialized[e] = this.specializerSpecs[e].term;
		this.specializers = this.specializerSpecs.map(tt), this.states = Fe(e.states, Uint32Array), this.data = Fe(e.stateData), this.goto = Fe(e.goto), this.maxTerm = e.maxTerm, this.tokenizers = e.tokenizers.map((e) => typeof e == "number" ? new ze(a, e) : e), this.topRules = e.topRules, this.dialects = e.dialects || {}, this.dynamicPrecedences = e.dynamicPrecedences || null, this.tokenPrecTable = e.tokenPrec, this.termNames = e.termNames || null, this.maxNode = this.nodeSet.types.length - 1, this.dialect = this.parseDialect(), this.top = this.topRules[Object.keys(this.topRules)[0]];
	}
	createParse(e, t, n) {
		let r = new Ye(this, e, t, n);
		for (let i of this.wrappers) r = i(r, e, t, n);
		return r;
	}
	getGoto(e, t, n = !1) {
		let r = this.goto;
		if (t >= r[0]) return -1;
		for (let i = r[t + 1];;) {
			let t = r[i++], a = t & 1, o = r[i++];
			if (a && n) return o;
			for (let n = i + (t >> 1); i < n; i++) if (r[i] == e) return o;
			if (a) return -1;
		}
	}
	hasAction(e, t) {
		let n = this.data;
		for (let r = 0; r < 2; r++) for (let i = this.stateSlot(e, r ? 2 : 1), a;; i += 3) {
			if ((a = n[i]) == 65535) {
				if (n[i + 1] == 1) a = n[i = $e(n, i + 2)];
				else if (n[i + 1] == 2) return $e(n, i + 2);
				else break;
			}
			if (a == t || a == 0) return $e(n, i + 1);
		}
		return 0;
	}
	stateSlot(e, t) {
		return this.states[e * 6 + t];
	}
	stateFlag(e, t) {
		return (this.stateSlot(e, 0) & t) > 0;
	}
	validAction(e, t) {
		return !!this.allActions(e, (e) => e == t || null);
	}
	allActions(e, t) {
		let n = this.stateSlot(e, 4), r = n ? t(n) : void 0;
		for (let n = this.stateSlot(e, 1); r == null; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = $e(this.data, n + 2);
				else break;
			}
			r = t($e(this.data, n + 1));
		}
		return r;
	}
	nextStates(e) {
		let t = [];
		for (let n = this.stateSlot(e, 1);; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = $e(this.data, n + 2);
				else break;
			}
			if (!(this.data[n + 2] & 1)) {
				let e = this.data[n + 1];
				t.some((t, n) => n & 1 && t == e) || t.push(this.data[n], e);
			}
		}
		return t;
	}
	configure(t) {
		let n = Object.assign(Object.create(e.prototype), this);
		if (t.props && (n.nodeSet = this.nodeSet.extend(...t.props)), t.top) {
			let e = this.topRules[t.top];
			if (!e) throw RangeError(`Invalid top rule name ${t.top}`);
			n.top = e;
		}
		return t.tokenizers && (n.tokenizers = this.tokenizers.map((e) => {
			let n = t.tokenizers.find((t) => t.from == e);
			return n ? n.to : e;
		})), t.specializers && (n.specializers = this.specializers.slice(), n.specializerSpecs = this.specializerSpecs.map((e, r) => {
			let i = t.specializers.find((t) => t.from == e.external);
			if (!i) return e;
			let a = Object.assign(Object.assign({}, e), { external: i.to });
			return n.specializers[r] = tt(a), a;
		})), t.contextTracker && (n.context = t.contextTracker), t.dialect && (n.dialect = this.parseDialect(t.dialect)), t.strict != null && (n.strict = t.strict), t.wrap && (n.wrappers = n.wrappers.concat(t.wrap)), t.bufferLength != null && (n.bufferLength = t.bufferLength), n;
	}
	hasWrappers() {
		return this.wrappers.length > 0;
	}
	getName(e) {
		return this.termNames ? this.termNames[e] : String(e <= this.maxNode && this.nodeSet.types[e].name || e);
	}
	get eofTerm() {
		return this.maxNode + 1;
	}
	get topNode() {
		return this.nodeSet.types[this.top[1]];
	}
	dynamicPrecedence(e) {
		let t = this.dynamicPrecedences;
		return t == null ? 0 : t[e] || 0;
	}
	parseDialect(e) {
		let t = Object.keys(this.dialects), n = t.map(() => !1);
		if (e) for (let r of e.split(" ")) {
			let e = t.indexOf(r);
			e >= 0 && (n[e] = !0);
		}
		let r = null;
		for (let e = 0; e < t.length; e++) if (!n[e]) for (let n = this.dialects[t[e]], i; (i = this.data[n++]) != 65535;) (r ||= new Uint8Array(this.maxTerm + 1))[i] = 1;
		return new Ze(e, n, r);
	}
	static deserialize(t) {
		return new e(t);
	}
};
function $e(e, t) {
	return e[t] | e[t + 1] << 16;
}
function et(e) {
	let t = null;
	for (let n of e) {
		let e = n.p.stoppedAt;
		(n.pos == n.p.stream.end || e != null && n.pos > e) && n.p.parser.stateFlag(n.state, 2) && (!t || t.score < n.score) && (t = n);
	}
	return t;
}
function tt(e) {
	if (e.external) {
		let t = +!!e.extend;
		return (n, r) => e.external(n, r) << 1 | t;
	}
	return e.get;
}
// src/dsl/grammar/dav.grammar
var nt = {
	__proto__: null,
	title: 10,
	group: 16,
	desc: 30,
	true: 40,
	false: 42,
	node: 54,
	step: 58,
	focus: 66,
	state: 70,
	animate: 74,
	code: 85,
	static: 92
}, rt = Qe.deserialize({
	version: 14,
	states: "-zQYQPOOOOQO'#Df'#DfOOQO'#D]'#D]QYQPOOOhQPO'#C_OmQPO'#CvOrQPO'#CcOwQPO'#CxOOQO-E7Z-E7ZOOQO,58y,58yO|QPO,59bO!hQPO,58}O!sQPO,59dOOQO'#Ce'#CeO!xQPO'#ChOOQO1G.|1G.|O#TQPO1G.|O#lQPO'#CuOOQO1G.i1G.iO!nQPO1G.iO!kQPO1G.iO$YQPO'#CzOOQO1G/O1G/OOOQO'#Cj'#CjO$aQPO'#CiOOQO,59S,59SO$fQPO,59SOOQO7+$h7+$hOOQO'#D_'#D_O$nQPO,59aOOQO,59a,59aOOQO7+$T7+$TO!nQPO7+$TOOQO'#Dh'#DhOOQO'#D`'#D`O$yQPO,59fOOQO,59f,59fO%QQPO'#C{O%VQPO'#C|O%[QPO'#DOO%aQPO'#DQO%fQPO'#DZO%kQPO,59TO&PQPO1G.nO&[QPO1G.nOOQO1G.n1G.nOOQO-E7]-E7]OOQO1G.{1G.{OOQO<<Go<<GoOOQO-E7^-E7^OOQO1G/Q1G/QOOQO,59g,59gO&dQPO,59hO&{QPO,59jO'QQPO,59lO'VQPO,59uOOQO'#Dg'#DgOOQO1G.o1G.oOOQO'#Co'#CoOOQO,59x,59xOOQO7+$Y7+$YO'[QPO7+$YOOQO-E7[-E7[O'gQPO'#DaO'lQPO1G/SOOQO1G/U1G/UO(TQPO1G/WO(YQPO1G/aOOQO<<Gt<<GtP(_QPO'#D^OOQO,59{,59{OOQO-E7_-E7_O(gQPO7+$rO)UQPO7+${O)pQPO'#DTO)uQPO'#DUOOQO<<H^<<H^O*QQPO<<H^O*iQPO<<H^OOQO<<Hg<<HgO*pQPO<<HgOOQO,59o,59oOOQO'#Db'#DbO+XQPO,59pOOQO,59p,59pO+dQPO'#DVOOQOAN=xAN=xO+oQPOAN=xOOQOAN>RAN>ROOQO-E7`-E7`OOQO1G/[1G/[OOQO'#DX'#DXO,WQPO,59qOOQO,59q,59qO,fQPO,59qOOQOG23dG23dOOQO1G/]1G/]O,nQPO1G/]OOQO7+$w7+$w",
	stateData: ",|~O!XOSPOS~OTSOWUOkTOmVO~OUXO~OSYO~OSZO~OU[O~OU]OZ^OTjaWjakjamja!Vjagja~OU]OZ^OhaO~OheO~OSgOYiO_gO~OZ^OTjiWjikjimji!Vjigji~OWUOgnOkTO~O_uOqvOswOuxO!OyO~OgtO~P#wO`zO~OY}Of{O~OWUOg!POkTO~Og!SO~P#wOU!TO~OS!UO~OS!VO~OS!WO~OS!XO~OS!YOU!YOa!YOb!YOd![Oe![O~OSgOY!^O_gO~OY!^Of!_O~Of!aO_pagpaqpaspaupa!Opa~OZ^O~Ov!dO~Ov!eO~OSgOY!fO_gO~OS!hO~Of!aO_pigpiqpispiupi!Opi~OS!jO~OS!kO~OSgO_gO~OZ^O`!lOh!mO_tqgtqqtqstqutq!Otq~OZ^O`!lO_}qg}qq}qs}qu}q!O}q~OU!sO~O_uOg!vOz!wO~Oh!mO_tygtyqtystyuty!Oty~OZ^O~P*QOZ^O_}yg}yq}ys}yu}y!O}y~O_uOg!|Oz!wO~OS!}OU#OO|#PO~Oh!mO_t!Rgt!Rqt!Rst!Rut!R!Ot!R~O|#SO_yagyazya~OU#TO|#SO~O|#UO_yigyizyi~O",
	goto: "%m!]PPP!^PPP!bP!jPP!p#]#ePPPP#kPPPPP#n!bP!^P#x#{$TP$TP$TPP$X$_$PP$iP$TP$l$r$x%O%U%[PPP%b%f%iTPORSPORTlamQ`YRdZQ_YQcZQk`QpdQ!c!VQ!o!jQ!q!kQ!y!pR!z!rQj^V!]{!_!gXh^{!_!gR!YzQbZSocdR!QpRf[SqesT!t!m!uTqesQ!p!jR!r!kQ!n!jS!x!o!pR#R!yR#Q!wQRORWRQ|jR!`|QmaR!OmQseR!RsQ!b!UR!i!bQ!u!mR!{!uTQORR!ZzTres",
	nodeNames: "⚠ LineComment Document Title Identifier title String Group group Label ] [ Attributes Attribute AttrName desc : Number Color Boolean true false , } { GroupBody Node node Step step StepBody Desc Focus focus State state Animate animate Arrow EdgeLabel AnimateBody Code code CodeLang CodeFence Static static",
	maxTerm: 58,
	nodeProps: [[
		"openedBy",
		10,
		"[",
		23,
		"{"
	], [
		"closedBy",
		11,
		"]",
		24,
		"}"
	]],
	skippedNodes: [0, 1],
	repeatNodeCount: 6,
	tokenData: "*h~RkX^!vpq!vrs#kst%_|}%y}!O&O!O!P&}!P!Q'T!Q![&d![!]'r!^!_'w!c!}(Q!}#O(c#P#Q(h#R#S(Q#S#T(m#T#o(Q#o#p*^#q#r*c#y#z!v$f$g!v#BY#BZ!v$IS$I_!v$I|$JO!v$JT$JU!v$KV$KW!v&FU&FV!v~!{Y!X~X^!vpq!v#y#z!v$f$g!v#BY#BZ!v$IS$I_!v$I|$JO!v$JT$JU!v$KV$KW!v&FU&FV!v~#nWOY#kZr#krs$Ws#O#k#O#P$]#P;'S#k;'S;=`%X<%lO#k~$]OU~~$`RO;'S#k;'S;=`$i;=`O#k~$lXOY#kZr#krs$Ws#O#k#O#P$]#P;'S#k;'S;=`%X;=`<%l#k<%lO#k~%[P;=`<%l#k~%bR!Q![%k!c!}%k#T#o%k~%pRb~!Q![%k!c!}%k#T#o%k~&OOf~~&RQ}!O&X!Q![&d~&[P!`!a&_~&dOv~~&iQa~!O!P&o!Q![&d~&rP!Q![&u~&zPa~!Q![&u~'QP!O!P&X~'WP!P!Q'Z~'`SP~OY'ZZ;'S'Z;'S;=`'l<%lO'Z~'oP;=`<%l'Z~'wO`~~'zQ}!O&X!O!P&X~(VSS~!Q![(Q!c!}(Q#R#S(Q#T#o(Q~(hOZ~~(mOY~~(pP#S#T(s~(vP#S#T(y~(|TO#S(y#S#T)]#T;'S(y;'S;=`*W<%lO(y~)`TO#S(y#S#T)o#T;'S(y;'S;=`*W<%lO(y~)rTO#S(y#S#T*R#T;'S(y;'S;=`*W<%lO(y~*WO|~~*ZP;=`<%l(y~*cOh~~*hOg~",
	tokenizers: [0],
	topRules: { Document: [0, 2] },
	specialized: [{
		term: 4,
		get: (e) => nt[e] || -1
	}],
	tokenPrec: 0
}), it = /* @__PURE__ */ new Set([
	"String",
	"Number",
	"Color",
	"Identifier",
	"Boolean"
]);
function at(e) {
	return rt.parse(e);
}
function ot(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) t.push(n);
	return t;
}
function st(e) {
	for (let t = e.firstChild; t; t = t.nextSibling) if (it.has(t.name)) return t;
	return null;
}
function B(e, t) {
	return e.slice(t.from, t.to);
}
function ct(e) {
	let t = [], n = e.length >= 2 && e.endsWith("\""), r = e.slice(1, n ? -1 : void 0), i = "";
	for (let e = 0; e < r.length; e++) {
		let n = r[e];
		if (n !== "\\") {
			i += n;
			continue;
		}
		let a = r[e + 1];
		switch (a) {
			case "\"":
				i += "\"";
				break;
			case "\\":
				i += "\\";
				break;
			case "n":
				i += "\n";
				break;
			case "t":
				i += "	";
				break;
			default: t.push({
				offset: e + 1,
				sequence: `\\${a ?? ""}`
			}), i += `\\${a ?? ""}`;
		}
		e++;
	}
	return {
		value: i,
		invalid: t
	};
}
function lt(e) {
	let t = e.startsWith("```"), n = e.length >= (t ? 6 : 3) && e.endsWith("```");
	return v(e.slice(t ? 3 : 0, n ? -3 : void 0));
}
// src/dsl/attributes.ts
var ut = {
	string: "\"...\"",
	bool: "true | false",
	color: C.join(" | "),
	stateColor: [...C, T].join(" | "),
	icon: x.join(" | "),
	border: D.join(" | "),
	mount: k.join(" | ")
};
function dt(e, t, n) {
	let { value: r, invalid: i } = ct(B(e, t));
	for (let e of i) {
		let r = t.from + e.offset;
		n("invalid-escape", "error", {
			from: r,
			to: r + e.sequence.length
		}, { sequence: e.sequence });
	}
	return r;
}
function ft(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	if (t) {
		let a = M[n], o = /* @__PURE__ */ new Set();
		for (let s of t.getChildren("Attribute")) {
			let t = s.getChild("AttrName"), c = st(s);
			if (!t || !c) continue;
			let l = B(e, t), u = Object.hasOwn(a, l) ? a[l] : void 0;
			if (!u) {
				r("unknown-attribute", "warning", t, {
					name: l,
					owner: n
				});
				continue;
			}
			o.has(l) && r("duplicate-attribute", "warning", t, { name: l }), o.add(l);
			let d = pt(e, l, u, c, r);
			d !== void 0 && i.set(l, {
				value: d,
				node: c
			});
		}
	}
	return {
		entries: i,
		get: (e) => i.get(e),
		value: (e) => i.get(e)?.value
	};
}
function pt(e, t, n, r, i) {
	let a = B(e, r), o = () => {
		i("invalid-attribute-value", "error", r, {
			name: t,
			expected: ut[n]
		});
	};
	switch (n) {
		case "string": return r.name === "String" ? dt(e, r, i) : o();
		case "bool": return r.name === "Boolean" ? a === "true" : o();
		case "color":
		case "stateColor": return r.name !== "Identifier" && r.name !== "Color" ? o() : mt(a, r, n === "stateColor", i);
		case "icon": return r.name === "Identifier" ? ht(a, r, i) : o();
		case "border": {
			if (r.name !== "Identifier") return o();
			let e = a.toLowerCase();
			return O(e) ? e : o();
		}
		case "mount": {
			if (r.name !== "Identifier") return o();
			let e = a.toLowerCase();
			return A(e) ? e : o();
		}
	}
}
function mt(e, t, n, r) {
	let i = e.toLowerCase();
	if (w(i)) return i;
	if (n && i === "none") return T;
	r("invalid-color", "error", t, {
		value: e,
		suggestion: (t.name === "Color" ? void 0 : ee(e, C)) ?? "",
		names: (n ? [...C, T] : C).join(", ")
	});
}
function ht(e, t, n) {
	let r = e.toLowerCase();
	if (S(r)) return r;
	n("unknown-icon", "error", t, {
		icon: e,
		suggestion: ee(e, x) ?? ""
	});
}
// src/dsl/sourceMap.ts
function gt(e) {
	return {
		from: e.from,
		to: e.to
	};
}
// src/dsl/analyze.ts
var _t = {
	style: "solid",
	direction: "forward"
};
function vt(e) {
	return new yt(e).run();
}
var yt = class {
	text;
	diagnostics = [];
	elements = /* @__PURE__ */ new Map();
	stepRanges = [];
	references = [];
	stateChecks = [];
	doc = {
		title: "",
		groups: [],
		nodes: [],
		steps: []
	};
	titleSeen = !1;
	reportFn = (e, t, n, r = {}) => {
		this.report(e, t, n, r);
	};
	constructor(e) {
		this.text = e;
	}
	run() {
		let e = at(this.text).topNode;
		this.collectSyntaxErrors(e);
		for (let t of ot(e)) switch (t.name) {
			case "Title":
				this.readTitle(t);
				break;
			case "Group":
				this.readGroup(t, void 0);
				break;
			case "Node":
				this.readNode(t, void 0);
				break;
			case "Step": this.readStep(t);
		}
		return this.doc.steps.length === 0 && this.report("missing-step", "error", {
			from: 0,
			to: 0
		}), this.resolveReferences(), this.diagnostics.sort((e, t) => e.from - t.from || e.to - t.to), {
			document: this.doc,
			diagnostics: this.diagnostics,
			sourceMap: {
				elements: this.elements,
				steps: this.stepRanges
			}
		};
	}
	collectSyntaxErrors(e) {
		let t = /* @__PURE__ */ new Set(), n = e.cursor();
		do {
			if (!n.type.isError || t.has(n.from)) continue;
			if (t.add(n.from), n.from >= _(this.text).length) {
				if (t.size > 1) continue;
				let e = this.text.length;
				this.report("unexpected-eof", "error", {
					from: e,
					to: e
				});
				continue;
			}
			let e = n.to > n.from ? B(this.text, n) : /^\S+/.exec(this.text.slice(n.from))?.[0] ?? "", r = (e) => (e.length > 24 ? `${e.slice(0, 24)}…` : e).split("\n")[0] ?? "", i = n.node.prevSibling, a = n.node.parent?.name === "Code" && !n.node.parent.getChild("CodeFence") && i?.name === "String" && e.startsWith("\"") && !this.text.slice(i.to, n.from).includes("\n") ? B(this.text, i) : void 0;
			this.report("syntax-error", "error", {
				from: n.from,
				to: Math.max(n.to, n.from + e.length)
			}, a === void 0 ? { token: r(e) } : {
				token: r(e),
				hint: "code-title",
				title: `"${r(a.slice(1, -1))}"`
			});
		} while (n.next());
	}
	readTitle(e) {
		let t = e.getChild("String");
		t && (this.titleSeen && this.report("duplicate-title", "warning", e), this.titleSeen = !0, this.doc.title = this.readString(t));
	}
	readGroup(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = B(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "group"), a = {
			id: r,
			label: this.readChildString(e, "Label") ?? r
		};
		t && (a.parentId = t);
		let o = i.value("color");
		o !== void 0 && (a.color = o);
		let s = i.value("border");
		s !== void 0 && (a.border = s);
		let c = this.declare({
			kind: "group",
			id: r,
			from: e.from,
			to: e.to,
			idRange: gt(n)
		});
		c && this.doc.groups.push(a);
		let l = e.getChild("GroupBody");
		if (!l) return;
		let u = c ? r : t;
		for (let e of ot(l)) e.name === "Group" ? this.readGroup(e, u) : e.name === "Node" && this.readNode(e, u);
	}
	readNode(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = B(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "node"), a = {
			id: r,
			label: this.readChildString(e, "Label") ?? r,
			icon: i.value("icon") ?? "server",
			visible: i.value("visible") ?? !0
		};
		t && (a.parentId = t);
		let o = i.value("sub");
		o !== void 0 && (a.sub = o);
		let s = i.value("badge");
		s !== void 0 && (a.badge = s);
		let c = i.value("color");
		c !== void 0 && (a.color = c);
		let l = i.get("mount");
		l !== void 0 && (t ? a.mount = l.value : this.report("attribute-not-applicable", "warning", l.node, {
			name: "mount",
			kind: "node"
		})), this.declare({
			kind: "node",
			id: r,
			from: e.from,
			to: e.to,
			idRange: gt(n)
		}) && this.doc.nodes.push(a);
	}
	readStep(e) {
		let t = {
			index: this.doc.steps.length,
			title: this.readChildString(e) ?? "",
			description: "",
			focus: [],
			states: [],
			animations: [],
			statics: []
		}, n = e.getChild("StepBody");
		for (let e of n ? ot(n) : []) switch (e.name) {
			case "Focus":
				for (let n of e.getChildren("Identifier")) {
					let e = B(this.text, n);
					t.focus.push(e), this.references.push({
						id: e,
						range: gt(n),
						allowed: ["node", "group"]
					});
				}
				break;
			case "State":
				this.readState(e, t);
				break;
			case "Animate":
				this.readAnimate(e, t);
				break;
			case "Static": this.readStatic(e, t);
		}
		t.description = this.readDescList(n).join("\n"), this.stepRanges.push({
			from: e.from,
			to: e.to
		}), this.doc.steps.push(t);
	}
	readState(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = B(this.text, n), i = e.getChild("Attributes"), a = this.readAttributes(i, "state");
		i && i.getChildren("Attribute").length === 0 && this.report("empty-state", "warning", e);
		let o = { target: r }, s = a.value("visible");
		s !== void 0 && (o.visible = s);
		let c = a.value("badge");
		c !== void 0 && (o.badge = c);
		let l = a.value("color");
		l !== void 0 && (o.color = l), t.states.push(o), this.references.push({
			id: r,
			range: gt(n),
			allowed: ["node", "group"]
		}), this.stateChecks.push({
			target: r,
			attrs: a.entries
		});
	}
	readConnection(e, t) {
		let [n, r] = e.getChildren("Identifier"), i = e.getChild("Arrow");
		if (!n || !r || !i) return;
		let a = B(this.text, n), o = B(this.text, r), s = B(this.text, i), c = F[s] ?? _t;
		a === o && c.direction === "bidirectional" && this.report("invalid-self-arrow", "error", i, {
			arrow: s,
			suggestion: c.style === "dashed" ? "..>" : "-->"
		});
		let l = t === "static" ? ["node", "group"] : ["node"];
		this.references.push({
			id: a,
			range: gt(n),
			allowed: l
		}, {
			id: o,
			range: gt(r),
			allowed: l
		});
		let u = this.readAttributes(e.getChild("Attributes"), t), d = this.readChildString(e, "EdgeLabel"), f = {
			from: a,
			to: o,
			style: c.style,
			direction: c.direction,
			attrs: u
		};
		return d !== void 0 && (f.label = d), f;
	}
	readStatic(e, t) {
		let n = this.readConnection(e, "static");
		if (!n) return;
		let r = {
			from: n.from,
			to: n.to,
			style: n.style,
			direction: n.direction
		};
		n.label !== void 0 && (r.label = n.label);
		let i = n.attrs.value("color");
		i !== void 0 && (r.color = i), t.statics.push(r);
	}
	readAnimate(e, t) {
		let n = this.readConnection(e, "animate");
		if (!n) return;
		let { attrs: r } = n, i = {
			from: n.from,
			to: n.to,
			style: n.style,
			direction: n.direction,
			parallel: r.value("parallel") ?? !1
		};
		n.label !== void 0 && (i.label = n.label);
		let a = r.value("color");
		a !== void 0 && (i.color = a);
		let o = r.value("icon");
		o !== void 0 && (i.icon = o);
		let s = [], c = r.value("desc");
		c !== void 0 && c.length > 0 && s.push(c);
		let l = e.getChild("AnimateBody");
		s.push(...this.readDescList(l)), s.length > 0 && (i.description = s.join("\n"));
		let u = !1, d, f = r.get("code");
		if (f !== void 0 && (u = !0, g(f.value) || (d = { body: f.value })), l) for (let e of ot(l)) {
			if (e.name !== "Code") continue;
			u && this.report("duplicate-code", "warning", e), u = !0;
			let t = this.readCode(e);
			t !== void 0 && (d = t);
		}
		d !== void 0 && (i.code = d), t.animations.push(i);
	}
	readCode(e) {
		let t = e.getChild("CodeLang"), n = e.getChild("String"), r = e.getChild("CodeFence"), i, a;
		if (r ? (n && (i = this.readString(n)), a = lt(B(this.text, r))) : n && (a = this.readString(n)), a === void 0 || g(a)) return;
		let o = { body: a };
		return t && (o.lang = B(this.text, t)), i !== void 0 && (o.title = i), o;
	}
	readString(e) {
		return dt(this.text, e, this.reportFn);
	}
	readChildString(e, t) {
		let n = (t ? e.getChild(t) : e)?.getChild("String");
		return n ? this.readString(n) : void 0;
	}
	readDescList(e) {
		if (!e) return [];
		let t = [];
		for (let n of ot(e)) if (n.name === "Desc") {
			let e = this.readChildString(n);
			e !== void 0 && t.push(e);
		}
		return t;
	}
	readAttributes(e, t) {
		return ft(this.text, e, t, this.reportFn);
	}
	declare(e) {
		return this.elements.has(e.id) ? (this.report("duplicate-id", "error", e.idRange ?? e, { id: e.id }), !1) : (this.elements.set(e.id, e), !0);
	}
	resolveReferences() {
		for (let e of this.references) {
			let t = this.elements.get(e.id);
			t ? e.allowed.includes(t.kind) || this.report("reference-kind-mismatch", "error", e.range, {
				id: e.id,
				actual: t.kind,
				expected: e.allowed.join("|")
			}) : this.report("undefined-reference", "error", e.range, { id: e.id });
		}
		for (let e of this.stateChecks) {
			let t = this.elements.get(e.target);
			if (!t) continue;
			let n = N[t.kind];
			for (let [r, i] of e.attrs) n.has(r) || this.report("attribute-not-applicable", "warning", i.node, {
				name: r,
				kind: t.kind
			});
		}
	}
	report(e, t, n, r = {}) {
		this.diagnostics.push({
			code: e,
			severity: t,
			from: n.from,
			to: n.to,
			args: r
		});
	}
}, bt = P.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
RegExp(`(?:${bt})\\s*\\w*$`), RegExp(`${bt}|^\\s*(?:animate|static)\\b`);
// src/dsl/diagnostics.ts
var xt = {
	ja: {
		"syntax-error": "構文エラー: \"{token}\" は解釈できません{hint}",
		"unexpected-eof": "入力が途中で終わっています（\"}\" や \"]\" の閉じ忘れの可能性があります）",
		"missing-step": "step が1つも定義されていません（少なくとも1つの step が必要です）",
		"duplicate-title": "title は1回だけ指定できます",
		"duplicate-id": "ID \"{id}\" は既に使われています",
		"undefined-reference": "\"{id}\" は定義されていません",
		"reference-kind-mismatch": "\"{id}\" は{actual}です（{expected}を指定してください）",
		"unknown-attribute": "属性 \"{name}\" は{owner}では使えません",
		"duplicate-attribute": "属性 \"{name}\" が重複しています（無視されなかった最後の値が使われます）",
		"invalid-attribute-value": "属性 \"{name}\" の値が不正です（期待: {expected}）",
		"unknown-icon": "アイコン \"{icon}\" は存在しません{suggestion}",
		"invalid-color": "色 \"{value}\" は不正です{suggestion}（使用可: {names}）",
		"invalid-self-arrow": "自己ループに双方向の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-escape": "エスケープシーケンス \"{sequence}\" は使えません（使用可: \\\" \\\\ \\n \\t）",
		"attribute-not-applicable": "属性 \"{name}\" は{kind}には適用されません",
		"empty-state": "state に属性が指定されていません",
		"duplicate-code": "code は1つの animate に1つだけ指定できます（空でない最後のものが使われます）"
	},
	en: {
		"syntax-error": "Syntax error: unexpected \"{token}\"{hint}",
		"unexpected-eof": "Unexpected end of input (a closing \"}\" or \"]\" may be missing)",
		"missing-step": "At least one step is required",
		"duplicate-title": "title can only be specified once",
		"duplicate-id": "ID \"{id}\" is already in use",
		"undefined-reference": "\"{id}\" is not defined",
		"reference-kind-mismatch": "\"{id}\" is {actual} (expected {expected})",
		"unknown-attribute": "Attribute \"{name}\" is not allowed on {owner}",
		"duplicate-attribute": "Duplicate attribute \"{name}\" (the last value that is not ignored is used)",
		"invalid-attribute-value": "Invalid value for attribute \"{name}\" (expected {expected})",
		"unknown-icon": "Unknown icon \"{icon}\"{suggestion}",
		"invalid-color": "Invalid color \"{value}\"{suggestion}. Use one of: {names}",
		"invalid-self-arrow": "Bidirectional arrow \"{arrow}\" cannot form a self-loop{suggestion}",
		"invalid-escape": "Invalid escape sequence \"{sequence}\" (allowed: \\\" \\\\ \\n \\t)",
		"attribute-not-applicable": "Attribute \"{name}\" does not apply to {kind}",
		"empty-state": "state has no attributes",
		"duplicate-code": "Only one code block is allowed per animate (the last one that is not empty is used)"
	}
}, St = {
	ja: {
		node: "ノード",
		group: "グループ",
		state: "state",
		animate: "animate",
		static: "static"
	},
	en: {
		node: "a node",
		group: "a group",
		state: "a state",
		animate: "an animate",
		static: "a static"
	}
}, Ct = {
	ja: "（もしかして \"{value}\"？）",
	en: " (did you mean \"{value}\"?)"
};
Object.keys(xt.en);
var wt = {
	ja: { "code-title": "。1行形式の code にはタイトルを付けられません。{title} がタイトルなら消すか、タイトルを残すならコードを ``` の行で囲んでください" },
	en: { "code-title": ". A one-line code takes no title: if {title} is one, remove it, or put the code between lines of ``` to keep it" }
}, Tt = /* @__PURE__ */ new Set([
	"owner",
	"kind",
	"actual",
	"expected"
]);
function Et(e, t = "en") {
	return xt[t][e.code].replace(/\{(\w+)\}/g, (n, r) => {
		let i = e.args[r] ?? "";
		return r === "suggestion" ? i ? Ct[t].replace("{value}", i) : "" : r === "hint" ? (wt[t][i] ?? "").replace("{title}", () => e.args.title ?? "") : Tt.has(r) ? i.split(/\s*\|\s*/).map((e) => St[t][e] ?? e).join(t === "ja" ? "・" : " or ") : i;
	});
}
// src/dsl/format.ts
var Dt = "  ", Ot = /* @__PURE__ */ new Set([
	"GroupBody",
	"StepBody",
	"AnimateBody"
]), kt = {
	Group: {
		body: "GroupBody",
		emptySuffix: " {}"
	},
	Step: {
		body: "StepBody",
		emptySuffix: " {}"
	},
	Animate: {
		body: "AnimateBody",
		emptySuffix: ""
	}
}, At = /* @__PURE__ */ new Set([
	"Title",
	"Group",
	"Node",
	"Step",
	"Desc",
	"Focus",
	"State",
	"Animate",
	"Static",
	"Code"
]);
function jt(e) {
	let t = at(e), n = !1;
	if (t.iterate({ enter: (t) => ((t.type.isError || t.name === "String" && e.slice(t.from, t.to).includes("\n")) && (n = !0), !n) }), n) return e;
	let r = [];
	new Mt(e, r).block(t.topNode, 0);
	let i = e.includes("\r\n") ? "\r\n" : "\n";
	return r.length > 0 ? `${r.join(i)}${i}` : "";
}
var Mt = class {
	text;
	lines;
	constructor(e, t) {
		this.text = e, this.lines = t;
	}
	block(e, t) {
		let n = Dt.repeat(t), r = -1, i = !0;
		for (let a of ot(e)) {
			let e = a.name === "LineComment";
			if (!e && !At.has(a.name)) continue;
			let o = Pt(r >= 0 ? this.text.slice(r, a.from) : "");
			e && r >= 0 && o === 0 ? this.appendToLastLine(` ${B(this.text, a).trimEnd()}`) : (!i && o >= 2 && this.lines.push(""), e ? this.lines.push(n + B(this.text, a).trimEnd()) : this.statement(a, t)), r = a.to, i = !1;
		}
	}
	statement(e, t) {
		let n = Dt.repeat(t);
		if (Nt(e)) {
			e.name === "Code" ? this.verbatimCode(e, n) : this.verbatim(e, n);
			return;
		}
		if (e.name === "Code") {
			this.code(e, n);
			return;
		}
		let r = Object.hasOwn(kt, e.name) ? kt[e.name] : void 0;
		if (r) {
			let i = e.getChild(r.body), a = this.inline(e, (e) => !Ot.has(e.name)), o = i !== null && ot(i).some((e) => e.name !== "{" && e.name !== "}");
			if (!i || !o) {
				this.lines.push(`${n}${a}${r.emptySuffix}`);
				return;
			}
			this.lines.push(`${n}${a} {`), this.block(i, t + 1), this.lines.push(`${n}}`);
		} else this.lines.push(n + this.inline(e, () => !0));
	}
	inline(e, t) {
		let n = [];
		for (let r of ot(e)) if (t(r)) switch (r.name) {
			case "Attributes":
				n.push(this.attributes(r));
				break;
			case "EdgeLabel": {
				let e = r.getChild("String");
				n.push(`: ${e ? B(this.text, e) : "\"\""}`);
				break;
			}
			case "Label":
				n.push(B(this.text, r));
				break;
			case ",": {
				let e = n[n.length - 1];
				e !== void 0 && (n[n.length - 1] = `${e},`);
				break;
			}
			default: n.push(B(this.text, r));
		}
		return n.join(" ");
	}
	attributes(e) {
		return `[${e.getChildren("Attribute").map((e) => {
			let t = e.getChild("AttrName"), n = st(e);
			return `${t ? B(this.text, t) : ""}: ${n ? B(this.text, n) : ""}`;
		}).join(", ")}]`;
	}
	code(e, t) {
		let n = e.getChild("CodeLang"), r = e.getChild("String"), i = e.getChild("CodeFence"), a = ["code"];
		n && a.push(B(this.text, n)), r && a.push(B(this.text, r)), i ? (a.push("```"), this.lines.push(`${t}${a.join(" ")}`), this.fenceBody(i, t)) : this.lines.push(`${t}${a.join(" ")}`);
	}
	verbatimCode(e, t) {
		let n = e.getChild("CodeFence");
		if (!n) {
			this.verbatim(e, t);
			return;
		}
		let r = B(this.text, {
			from: e.from,
			to: n.from
		}).replace(/[^\P{White_Space}\n]*$/u, ""), i = r.endsWith("\n"), a = i ? r.replace(/\r?\n$/, "") : r;
		this.verbatimSpan(a, e.from, t), i ? this.lines.push(`${t}\`\`\``) : this.appendToLastLine(" ```"), this.fenceBody(n, t);
	}
	fenceBody(e, t) {
		let n = lt(B(this.text, e));
		if (n.length > 0) for (let e of n.split("\n")) this.lines.push(e.length > 0 ? `${t}  ${e}` : "");
		this.lines.push(`${t}\`\`\``);
	}
	verbatim(e, t) {
		this.verbatimSpan(B(this.text, e), e.from, t, Ft(e));
	}
	verbatimSpan(e, t, n, r = []) {
		let i = It(this.lineAt(t)), a = (e) => r.some((t) => e > t.from && e < t.to), o = !0;
		for (let r of e.matchAll(/([^\n]*?)(\r?\n|$)/g)) {
			let e = r[1] ?? "", s = t + (r.index ?? 0), c = [], l = 0;
			for (let t = e.indexOf("\r"); t >= 0; t = e.indexOf("\r", t + 1)) a(s + t) && (c.push(e.slice(l, t)), l = t + 1);
			let [u = "", ...d] = [...c, e.slice(l)];
			if (o) this.lines.push(n + _(u)), o = !1;
			else if (a(s)) this.lines.push(_(u));
			else {
				let e = _(u.startsWith(i) ? u.slice(i.length) : u.trimStart());
				this.lines.push(e ? n + e : "");
			}
			for (let e of d) this.lines.push(_(e));
			if (!r[2]) break;
		}
	}
	lineAt(e) {
		let t = this.text.lastIndexOf("\n", e - 1) + 1, n = this.text.indexOf("\n", e);
		return this.text.slice(t, n < 0 ? void 0 : n);
	}
	appendToLastLine(e) {
		let t = this.lines.length - 1, n = this.lines[t];
		n === void 0 ? this.lines.push(e.trimStart()) : this.lines[t] = n + e;
	}
};
function Nt(e) {
	for (let t of ot(e)) if (t.name === "LineComment" || !Ot.has(t.name) && Nt(t)) return !0;
	return !1;
}
function Pt(e) {
	let t = 0;
	for (let n of e) n === "\n" && t++;
	return t;
}
function Ft(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) n.name === "CodeFence" ? t.push({
		from: n.from,
		to: n.to
	}) : t.push(...Ft(n));
	return t;
}
function It(e) {
	return /^\s*/.exec(e)?.[0] ?? "";
}
// src/model/zones.ts
function Lt(e) {
	return new Map(e.map((e) => [e.id, e.parentId]));
}
function V(e) {
	return e.filter((e) => e.parentId === void 0);
}
function Rt(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n.id, n.parentId === void 0 ? n.id : t.get(n.parentId) ?? n.id);
	return t;
}
function zt(e) {
	let t = Rt(e.groups);
	return new Map(e.nodes.map((e) => [e.id, e.parentId === void 0 ? void 0 : t.get(e.parentId) ?? e.parentId]));
}
function Bt(e, t) {
	let n = [];
	for (let r = t; r !== void 0; r = e.get(r)) n.push(r);
	return n;
}
var H = (e, t) => `${e}\u0000${t}`;
// src/model/connections.ts
function Vt(e, t) {
	return e <= t ? H(e, t) : H(t, e);
}
function Ht(e, t, n, r, i, a, o, s) {
	let c = Vt(t, n), l = e.get(c);
	l || (l = {
		key: c,
		from: t,
		to: n,
		seenForward: !1,
		seenBackward: !1,
		seenSolid: !1,
		animated: !1
	}, e.set(c, l)), t === n ? l.seenForward = !0 : i === "bidirectional" ? (l.seenForward = !0, l.seenBackward = !0) : l.from === t && l.to === n ? l.seenForward = !0 : l.seenBackward = !0, r === "solid" && (l.seenSolid = !0), a === "animate" ? (l.animated = !0, o !== void 0 && o.trim().length > 0 && l.animateLabel === void 0 && (l.animateLabel = o)) : (s !== void 0 && (l.staticColor = s), o !== void 0 && (l.staticLabel = o));
}
function Ut(e, t = j(e.from, e.to)) {
	return {
		id: t,
		from: e.from,
		to: e.to,
		style: e.seenSolid ? "solid" : "dashed",
		direction: e.from !== e.to && e.seenForward && e.seenBackward ? "bidirectional" : "forward",
		animated: e.animated
	};
}
function U(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.steps) {
		for (let e of n.animations) Ht(t, e.from, e.to, e.style, e.direction, "animate");
		for (let e of n.statics) Ht(t, e.from, e.to, e.style, e.direction, "static", e.label, e.color);
	}
	return [...t.values()].map((e) => Ut(e));
}
function Wt(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e.steps) {
		for (let e of n.animations) e.from === e.to && t.add(e.from);
		for (let e of n.statics) e.from === e.to && t.add(e.from);
	}
	return t;
}
// src/layout/metrics.ts
var W = {
	width: 176,
	height: 118
}, G = {
	x: 40,
	y: 40
}, Gt = {
	width: 160,
	height: 40
}, Kt = 30;
function qt(e) {
	return Math.ceil(d(e, 16) + 14 + 12);
}
function Jt(e) {
	let t = Math.min(350, qt(e));
	return Math.ceil(t / 2) * 2;
}
function Yt(e, t) {
	let n = Math.max(40, t - 14 - 4);
	return d(e, 16) > n ? 38 : 18;
}
function Xt(e) {
	return new Map([...Wt(e)].map((e) => [e, Kt]));
}
function K() {
	return Object.create(null);
}
function Zt(e) {
	let t = e[0];
	if (!t) return {
		...G,
		width: 0,
		height: 0
	};
	let n = t.x, r = t.y, i = t.x + t.width, a = t.y + t.height;
	for (let t = 1; t < e.length; t++) {
		let o = e[t];
		o && (n = Math.min(n, o.x), r = Math.min(r, o.y), i = Math.max(i, o.x + o.width), a = Math.max(a, o.y + o.height));
	}
	return {
		x: n,
		y: r,
		width: i - n,
		height: a - r
	};
}
// src/layout/borderMount.ts
var Qt = 56, $t = 44, en = W.height - 50 + 8, tn = 36, nn = 28, rn = 20, an = 24, on = W.height + 12, sn = 136, cn = (e, t, n) => n < t ? (t + n) / 2 : Math.max(t, Math.min(n, e));
function ln(e, t) {
	return {
		x: e.x + e.width / 2,
		y: t ? e.y + 50 : e.y + e.height / 2
	};
}
function un(e, t, n) {
	let r = /* @__PURE__ */ new Set([t]);
	for (let i of e.groups) Bt(n, i.parentId).includes(t) && r.add(i.id);
	for (let t of e.nodes) t.parentId !== void 0 && r.has(t.parentId) && r.add(t.id);
	return r;
}
function dn(e, t, n, r) {
	if (e.length === 0) return [];
	let i = e.map((e) => cn(e, n, r));
	if (i.length === 1) return i;
	for (let e = 1; e < i.length; e++) {
		let r = i[e - 1] ?? n;
		(i[e] ?? n) < r + t && (i[e] = r + t);
	}
	let a = i[i.length - 1] ?? r;
	if (a > r) {
		let e = a - r;
		for (let t = 0; t < i.length; t++) i[t] = (i[t] ?? n) - e;
		for (let e = 0; e < i.length; e++) (i[e] ?? n) < n && (i[e] = n);
		for (let e = 1; e < i.length; e++) {
			let r = i[e - 1] ?? n;
			(i[e] ?? n) < r + t && (i[e] = r + t);
		}
	}
	return i;
}
function fn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.nodes) if (r.mount === "border" && r.parentId && t.nodes[r.id] && t.groups[r.parentId]) {
		let e = n.get(r.parentId) ?? [];
		e.push(r), n.set(r.parentId, e);
	}
	if (n.size === 0) return t;
	let r = K();
	for (let [e, n] of Object.entries(t.nodes)) r[e] = { ...n };
	let i = K();
	for (let [e, n] of Object.entries(t.groups)) i[e] = { ...n };
	let a = Lt(e.groups), o = new Map(e.groups.map((e) => [e.id, e])), s = U(e), c = [...n.keys()].sort((e, t) => {
		let n = Bt(a, a.get(e)).length;
		return Bt(a, a.get(t)).length - n || (e < t ? -1 : +(e > t));
	}), l = (e) => {
		let t = r[e];
		if (t) return {
			rect: t,
			isNode: !0
		};
		let n = i[e];
		if (n) return {
			rect: n,
			isNode: !1
		};
	};
	for (let u of c) {
		let c = o.get(u), d = i[u], f = n.get(u);
		if (!c || !d || !f || f.length === 0) continue;
		let p = new Set(f.map((e) => e.id)), m = un(e, u, a), h = [];
		for (let t of e.nodes) if (t.parentId === u && !p.has(t.id)) {
			let e = r[t.id];
			e && h.push(e);
		}
		for (let t of e.groups) if (t.parentId === u) {
			let e = i[t.id];
			e && h.push(e);
		}
		let g = h.length > 0 ? Zt(h) : void 0, _ = g ? {
			x: g.x + g.width / 2,
			y: g.y + g.height / 2
		} : {
			x: d.x + d.width / 2,
			y: d.y + d.height / 2
		}, v = {
			left: [],
			right: [],
			top: [],
			bottom: []
		};
		for (let e of f) {
			let t = r[e.id];
			if (!t) continue;
			let n = ln(t, !0), i = [], a = [], o = 0, c = 0;
			for (let t of s) {
				if (t.from !== e.id && t.to !== e.id) continue;
				let n = t.from === e.id ? t.to : t.from;
				if (n === e.id || n === u) continue;
				let r = l(n);
				if (!r) continue;
				let s = ln(r.rect, r.isNode);
				m.has(n) ? (a.push({
					pt: s,
					animated: t.animated
				}), t.from === e.id ? c++ : o++) : i.push({
					pt: s,
					animated: t.animated
				});
			}
			let f;
			if (i.length > 0) {
				let e = i.reduce((e, t) => e + t.pt.x, 0) / i.length, t = i.reduce((e, t) => e + t.pt.y, 0) / i.length, n = (e - _.x) / Math.max(1, d.width / 2), r = (t - _.y) / Math.max(1, d.height / 2);
				f = Math.abs(n) >= Math.abs(r) ? n <= 0 ? "left" : "right" : r <= 0 ? "top" : "bottom";
			} else f = c > o ? "left" : o > c ? "right" : "top";
			v[f].push({
				node: e,
				mCenter: n,
				intNbrs: a,
				extNbrs: i
			});
		}
		let y = c.parentId, b = y ? i[y] : void 0, x = y ? o.get(y) : void 0, S = x && b ? Yt(x.label, b.width) : 0, C = [];
		for (let t of e.groups) if (t.parentId === y && t.id !== u) {
			let e = i[t.id];
			e && C.push(e);
		}
		for (let t of e.nodes) if (t.parentId === y) {
			let e = r[t.id];
			e && C.push(e);
		}
		let w = d.x, T = d.x + d.width, E = d.y, D = d.y + d.height;
		if (g) {
			let e = f.map((e) => t.nodes[e.id]).filter((e) => e !== void 0);
			if (v.left.length > 0) {
				let e = g.x - Qt, t = Math.max(...v.left.map((e) => ln(r[e.node.id], !0).x));
				if (e >= d.x + rn) w = Math.round(cn(t, d.x + rn, e));
				else if (e < d.x) {
					let t = b ? b.x + 16 + nn : -Infinity;
					for (let e of C) e.y < D && e.y + e.height > E && e.x + e.width <= d.x + 1 && (t = Math.max(t, e.x + e.width + nn));
					t < d.x && (w = Math.round(Math.max(t, e)));
				}
			} else e.some((e) => e.x < g.x) && g.x - 16 > w && (w = Math.round(Math.min(g.x - 16, T - Jt(c.label))), w < d.x && (w = d.x));
			if (v.right.length > 0) {
				let e = Math.max(g.x + g.width + Qt, w + Jt(c.label)), t = Math.min(...v.right.map((e) => ln(r[e.node.id], !0).x));
				if (e <= d.x + d.width - rn) T = Math.round(cn(t, e, d.x + d.width - rn));
				else if (e > d.x + d.width) {
					let t = b ? b.x + b.width - 16 - nn : Infinity;
					for (let e of C) e.y < D && e.y + e.height > E && e.x >= d.x + d.width - 1 && (t = Math.min(t, e.x - nn));
					t > d.x + d.width && (T = Math.round(Math.min(t, e)));
				}
			} else e.some((e) => e.x + e.width > g.x + g.width) && g.x + g.width + 16 < T && (T = Math.round(Math.max(g.x + g.width + 16, w + Jt(c.label))), T > d.x + d.width && (T = d.x + d.width));
			let n = Yt(c.label, T - w);
			if (v.top.length > 0) {
				let e = g.y - Math.max(n + $t, en), t = Math.max(...v.top.map((e) => ln(r[e.node.id], !0).y));
				if (e >= d.y + an) E = Math.round(cn(t, d.y + an, e));
				else if (e < d.y) {
					let t = b ? b.y + S + 16 + nn : -Infinity;
					for (let e of C) e.x < T && e.x + e.width > w && e.y + e.height <= d.y + 1 && (t = Math.max(t, e.y + e.height + nn));
					t < d.y && (E = Math.round(Math.max(t, e)));
				}
			} else e.some((e) => e.y < g.y) && g.y - n - 16 > E && (E = Math.round(Math.min(g.y - n - 16, D - 80)), E < d.y && (E = d.y));
			if (v.bottom.length > 0) {
				let e = g.y + g.height + Math.max($t, tn), t = Math.min(...v.bottom.map((e) => ln(r[e.node.id], !0).y));
				if (e <= d.y + d.height - an) D = Math.round(cn(t, e, d.y + d.height - an));
				else if (e > d.y + d.height) {
					let t = b ? b.y + b.height - 16 - nn : Infinity;
					for (let e of C) e.x < T && e.x + e.width > w && e.y >= d.y + d.height - 1 && (t = Math.min(t, e.y - nn));
					t > d.y + d.height && (D = Math.round(Math.min(t, e)));
				}
			} else e.some((e) => e.y + e.height > g.y + g.height) && g.y + g.height + 16 < D && (D = Math.round(Math.max(g.y + g.height + 16, E + 80)), D > d.y + d.height && (D = d.y + d.height));
		}
		let O = {
			x: w,
			y: E,
			width: Math.max(Jt(c.label), T - w),
			height: Math.max(80, D - E)
		};
		i[u] = O;
		let k = Yt(c.label, O.width), A = O.x + Math.min(qt(c.label) + 40, O.width * .65), j = (e, t, n, r) => {
			let i = (e) => t ? e.y : e.x, a = [...e.intNbrs, ...e.extNbrs], o = a.filter((e) => {
				let t = i(e.pt);
				return t >= n && t <= r;
			}), s = o.filter((e) => e.animated), c = s.length > 0 ? s : o.length > 0 ? o : e.intNbrs.length > 0 ? e.intNbrs : a;
			return c.length === 0 ? i(e.mCenter) : c.reduce((e, t) => e + i(t.pt), 0) / c.length;
		};
		for (let e of [
			"left",
			"right",
			"top",
			"bottom"
		]) {
			let t = v[e];
			if (t.length !== 0) {
				if (e === "left" || e === "right") {
					let n = e === "left" ? O.x : O.x + O.width, i = O.y + k + 36, a = O.y + O.height - (W.height - 50), o = t.map((e) => ({
						node: e.node,
						targetCoord: j(e, !0, i, a)
					})).sort((e, t) => e.targetCoord - t.targetCoord || (e.node.id < t.node.id ? -1 : +(e.node.id > t.node.id))), s = dn(o.map((e) => e.targetCoord), on, i, a);
					o.forEach((e, t) => {
						let a = s[t] ?? i;
						r[e.node.id] = {
							x: Math.round(n - W.width / 2),
							y: Math.round(a - 50),
							width: W.width,
							height: W.height
						};
					});
				} else {
					let n = e === "top" ? O.y : O.y + O.height, i = e === "top" ? Math.max(O.x + 56, A) : O.x + 56, a = O.x + O.width - 56, o = t.map((e) => ({
						node: e.node,
						targetCoord: j(e, !1, i, a)
					})).sort((e, t) => e.targetCoord - t.targetCoord || (e.node.id < t.node.id ? -1 : +(e.node.id > t.node.id))), s = dn(o.map((e) => e.targetCoord), sn, i, a);
					o.forEach((e, t) => {
						let a = s[t] ?? i;
						r[e.node.id] = {
							x: Math.round(a - W.width / 2),
							y: Math.round(n - 50),
							width: W.width,
							height: W.height
						};
					});
				}
			}
		}
	}
	return {
		nodes: r,
		groups: i
	};
}
// src/layout/flow.ts
var q = (e, t) => e < t ? H(e, t) : H(t, e);
function pn(e, t, n) {
	if (e.role !== "primary") return !1;
	let r = n.get(e.from) ?? e.from, i = n.get(e.to) ?? e.to;
	if (r === i) return !1;
	let a = t.pairFirstStep.get(q(e.from, e.to)) ?? 0;
	return t.auxiliaryZones.has(r) && !t.auxiliaryZones.has(i) && a >= 2 && (t.zoneStage.get(r) ?? 0) >= (t.zoneStage.get(i) ?? 0);
}
var mn = (e, t) => e < t ? -1 : +(e > t);
function hn(e) {
	let t = zt(e), n = Rt(e.groups), r = new Set(V(e.groups).map((e) => e.id)), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set();
	for (let t of e.groups) {
		let e = n.get(t.id) ?? t.id;
		i.set(t.id, e), r.has(t.id) && a.add(t.id);
	}
	for (let n of e.nodes) {
		let e = t.get(n.id), o = e !== void 0 && r.has(e) ? e : n.id;
		i.set(n.id, o), a.add(o);
	}
	return {
		owners: i,
		blockIds: [...a].sort(mn)
	};
}
function J(e, t, n) {
	let r = e.get(t);
	r || (r = /* @__PURE__ */ new Set(), e.set(t, r)), r.add(n);
}
function Y(e, t, n) {
	if (t === n) return !0;
	let r = /* @__PURE__ */ new Set([t]), i = [t];
	for (let t = 0; t < i.length; t++) {
		let a = i[t];
		if (a !== void 0) for (let t of e.get(a) ?? []) {
			if (t === n) return !0;
			r.has(t) || (r.add(t), i.push(t));
		}
	}
	return !1;
}
function gn(e, t) {
	let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
	for (let i of e.connections) {
		if (i.role !== "primary") continue;
		let a = t.get(i.from) ?? i.from, o = t.get(i.to) ?? i.to;
		if (a === o || e.auxiliaryZones.has(a) || e.auxiliaryZones.has(o)) continue;
		let s = q(a, o);
		r.has(s) || r.set(s, [a, o]), (e.zoneStage.get(a) ?? 0) < (e.zoneStage.get(o) ?? 0) && J(n, a, o);
	}
	let i = [.../* @__PURE__ */ new Set([...e.zoneStage.keys(), ...t.values()])], a = [];
	for (let [t, o] of r.values()) {
		let r = /* @__PURE__ */ new Set();
		for (let a of i) a === t || a === o || e.auxiliaryZones.has(a) || (Y(n, t, a) && Y(n, a, o) || Y(n, o, a) && Y(n, a, t)) && r.add(a);
		a.push({
			a: t,
			b: o,
			allowed: r
		});
	}
	return a;
}
function _n(e, t, n) {
	let r = 0;
	for (let { a: i, b: a, allowed: o } of e) {
		let e = n?.get(i), s = n?.get(a);
		if (e !== void 0 && s !== void 0 && e !== s) continue;
		let c = t.get(i), l = t.get(a);
		if (!c || !l) continue;
		let u = c.x + c.width / 2, d = l.x + l.width / 2, f = Math.min(u, d), p = Math.max(u, d), m = Math.min(c.y, l.y), h = Math.max(c.y + c.height, l.y + l.height);
		for (let [c, l] of t) {
			if (c === i || c === a || o.has(c)) continue;
			if (n) {
				let t = n.get(c);
				if (t !== void 0 && (e !== void 0 && t !== e || s !== void 0 && t !== s)) continue;
			}
			let t = l.x + l.width / 2;
			t > f && t < p && l.y < h && l.y + l.height > m && r++;
		}
	}
	return r;
}
function X(e, t = U(e)) {
	let n = /* @__PURE__ */ new Set([...e.nodes.map((e) => e.id), ...e.groups.map((e) => e.id)]), { owners: r, blockIds: i } = hn(e), a = /* @__PURE__ */ new Map();
	for (let e of t) e.from !== e.to && n.has(e.from) && n.has(e.to) && a.set(q(e.from, e.to), e);
	let o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), l = 0, u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Set(), g = /* @__PURE__ */ new Map(), _ = [], v = /* @__PURE__ */ new Set(), y = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Map(), x = 0, S = !1, C = (e, t, r) => {
		if (e === t || !n.has(e) || !n.has(t)) return;
		let i = q(e, t);
		a.has(i) && (y.has(i) || (y.set(i, r), b.set(i, x++)));
	}, w = (e, t, n) => {
		Y(f, t, e) || J(f, e, t), h.add(t);
		let i = r.get(e), a = r.get(t);
		if (i !== void 0 && a !== void 0 && i !== a && !Y(p, a, i) && J(p, i, a), !n.has(t)) {
			n.add(t);
			for (let e of m.get(t) ?? []) w(t, e, n);
		}
	}, T = (e) => {
		let t = m.get(e);
		if (!t || t.length === 0) return;
		let n = /* @__PURE__ */ new Set([e]);
		for (let r of t) w(e, r, n);
	}, E = (e) => {
		if (!o.has(e)) {
			o.set(e, l++), h.add(e);
			let t = r.get(e);
			t !== void 0 && s.add(t), T(e);
		}
	}, D = (e, t, n) => {
		let i = q(e, t);
		if (g.has(i)) return;
		c.has(e) ? c.add(t) : c.delete(t), J(u, e, t), J(f, e, t);
		let a = r.get(e), o = r.get(t);
		a !== void 0 && o !== void 0 && a !== o && (Y(d, o, a) || J(d, a, o), Y(p, o, a) || J(p, a, o)), E(e), E(t), g.set(i, {
			from: e,
			to: t,
			role: "primary",
			direction: n
		});
		let s = H(e, t);
		v.has(s) || (v.add(s), _.push([e, t]));
	}, O = 0;
	for (let t of e.steps) {
		if (!(t.statics.some((e) => e.from !== e.to && a.has(q(e.from, e.to))) || t.animations.some((e) => e.from !== e.to && a.has(q(e.from, e.to))))) continue;
		let e = O++, i = [];
		for (let r of t.statics) {
			if (C(r.from, r.to, e), r.from === r.to || r.direction !== "forward" || !n.has(r.from) || !n.has(r.to) || !a.has(q(r.from, r.to))) continue;
			let t = m.get(r.from);
			t ? t.push(r.to) : m.set(r.from, [r.to]), i.push(r.from);
		}
		for (let e of i) h.has(e) && T(e);
		for (let n of t.animations) {
			if (n.from === n.to) continue;
			let t = q(n.from, n.to);
			if (!a.has(t) || (C(n.from, n.to, e), S = !0, g.has(t))) continue;
			if (n.direction === "bidirectional") {
				let e = r.get(n.from), i = r.get(n.to), a = n.from, l = n.to;
				(Y(f, n.to, n.from) && !Y(f, n.from, n.to) || e !== void 0 && i !== void 0 && e !== i && Y(p, i, e) && !Y(p, e, i)) && (a = n.to, l = n.from);
				let u = r.get(a), d = r.get(l), m = Y(f, l, a), h = u !== void 0 && d !== void 0 && u !== d && s.has(d) && Y(p, d, u);
				m || h ? (g.set(t, {
					from: n.from,
					to: n.to,
					role: "return",
					direction: "bidirectional"
				}), o.has(l) || c.add(l)) : D(a, l, "bidirectional");
				continue;
			}
			let i = Y(f, n.to, n.from), l = r.get(n.from), u = r.get(n.to), d = l !== void 0 && u !== void 0 && l !== u && s.has(u) && Y(p, u, l), m = c.has(n.from) && o.has(n.to);
			i || d || m ? (g.set(t, {
				from: n.from,
				to: n.to,
				role: "return",
				direction: "forward"
			}), o.has(n.to) || c.add(n.to)) : D(n.from, n.to, "forward");
		}
	}
	let k = [];
	for (let [e, t] of a) {
		if (g.has(e)) continue;
		let n = {
			from: t.from,
			to: t.to,
			role: "static",
			direction: t.direction
		};
		g.set(e, n), k.push(n);
	}
	let { egressReturnPairs: A, egressAnchors: j, primaryBackboneAdj: M } = S ? yn(_, k) : {
		egressReturnPairs: /* @__PURE__ */ new Set(),
		egressAnchors: /* @__PURE__ */ new Map(),
		primaryBackboneAdj: /* @__PURE__ */ new Map()
	}, N = [..._];
	if (S) for (let e of k) {
		if (M.has(e.from) && M.has(e.to) && Y(M, e.from, e.to) || A.has(q(e.from, e.to)) || Y(u, e.to, e.from)) continue;
		let t = r.get(e.from), n = r.get(e.to);
		t !== void 0 && n !== void 0 && t !== n && Y(d, n, t) || (J(u, e.from, e.to), N.push([e.from, e.to]));
	}
	else for (let e of k) N.push([e.from, e.to]);
	let P = [...g.values()], { zoneStage: F, auxiliaryZones: ee, primaryZonePairs: I } = xn(new Set(V(e.groups).map((e) => e.id)), P, r, i, d, S, y, O, A);
	return {
		connections: P,
		byPair: g,
		forwardEdges: N,
		hasAnimate: S,
		zoneStage: F,
		auxiliaryZones: ee,
		primaryZonePairs: I,
		pairFirstStep: y,
		pairFirstOrder: b,
		activeStepCount: O,
		egressReturnPairs: A,
		egressAnchors: j,
		primaryBackboneAdj: M
	};
}
function vn(e, t, n) {
	if (!n.hasAnimate) return !1;
	if (n.egressReturnPairs?.has(q(e, t))) return !0;
	let r = n.primaryBackboneAdj;
	return !!(r?.has(e) && r.has(t) && Y(r, e, t));
}
function yn(e, t) {
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
	for (let [t, a] of e) n.add(t), n.add(a), J(r, t, a), J(i, t, a), J(i, a, t);
	let a = /* @__PURE__ */ new Map();
	for (let e of t) e.direction === "forward" && J(a, e.from, e.to);
	let o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map();
	for (let e of t) {
		if (e.direction !== "forward" || !n.has(e.from) || n.has(e.to)) continue;
		let t = e.from, i = e.to, c = /* @__PURE__ */ new Set([i]), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Set(), d = [i];
		for (let e = 0; e < d.length; e++) {
			let i = d[e];
			if (i !== void 0) for (let e of a.get(i) ?? []) n.has(e) ? Y(r, e, t) && (u.add(e), J(l, e, i)) : (J(l, e, i), c.has(e) || (c.add(e), d.push(e)));
		}
		if (u.size === 0) continue;
		let f = [...u].sort(mn), p = f[0], m = /* @__PURE__ */ new Set(), h = [...f];
		for (let e = 0; e < h.length; e++) {
			let t = h[e];
			if (t !== void 0) for (let e of l.get(t) ?? []) m.has(e) || (m.add(e), h.push(e));
		}
		if (m.has(i)) {
			o.add(q(t, i));
			for (let e of m) {
				p !== void 0 && !s.has(e) && s.set(e, p);
				for (let t of a.get(e) ?? []) (m.has(t) || u.has(t)) && o.add(q(e, t));
			}
		}
	}
	return {
		egressReturnPairs: o,
		egressAnchors: s,
		primaryBackboneAdj: i
	};
}
function bn(e, t, n, r) {
	let i = r.connections.filter((e) => n.has(e.from) && n.has(e.to)), a = /* @__PURE__ */ new Map();
	for (let e of i) a.set(q(e.from, e.to), e);
	let o = i.some((e) => e.role !== "static" && n.get(e.from) !== n.get(e.to)), s = i.filter((e) => e.role === "primary").sort((e, t) => {
		let n = q(e.from, e.to), i = q(t.from, t.to), a = r.pairFirstStep.get(n) ?? 0, o = r.pairFirstStep.get(i) ?? 0, s = r.pairFirstOrder?.get(n) ?? 0, c = r.pairFirstOrder?.get(i) ?? 0;
		return a - o || s - c || mn(e.from, t.from) || mn(e.to, t.to);
	}), c = /* @__PURE__ */ new Map();
	for (let e of s) {
		let t = n.get(e.from), r = n.get(e.to);
		t && r && t !== r && !Y(c, r, t) && J(c, t, r);
	}
	let l = r.egressReturnPairs ?? /* @__PURE__ */ new Set(), { zoneStage: u, auxiliaryZones: d, primaryZonePairs: f } = xn(e, i, n, t, c, o, r.pairFirstStep, r.activeStepCount, l);
	return {
		connections: i,
		byPair: a,
		forwardEdges: r.forwardEdges.filter(([e, t]) => n.has(e) && n.has(t)),
		hasAnimate: o,
		zoneStage: u,
		auxiliaryZones: d,
		primaryZonePairs: f,
		pairFirstStep: r.pairFirstStep,
		...r.pairFirstOrder ? { pairFirstOrder: r.pairFirstOrder } : {},
		activeStepCount: r.activeStepCount,
		egressReturnPairs: l,
		...r.egressAnchors ? { egressAnchors: r.egressAnchors } : {},
		...r.primaryBackboneAdj ? { primaryBackboneAdj: r.primaryBackboneAdj } : {}
	};
}
function xn(e, t, n, r, i, a, o, s, c) {
	let l = e, u = /* @__PURE__ */ new Map(), d = new Map(r.map((e) => [e, 0])), f = new Map(r.map((e) => [e, /* @__PURE__ */ new Set()])), p = new Map(r.map((e) => [e, /* @__PURE__ */ new Set()])), m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map(), _ = (e, t) => {
		let n = g.get(e);
		(n === void 0 || t < n) && g.set(e, t);
	}, v = /* @__PURE__ */ new Set(), y = new Map(r.map((e) => [e, 0]));
	for (let e of n.values()) y.set(e, (y.get(e) ?? 0) + 1);
	let b = s >= 4, x = (e) => b ? 1 / (1 + .12 * Math.max(0, e - 2)) : 1, S = new Map(r.map((e) => [e, 0])), C = new Map(r.map((e) => [e, 0])), w = new Map(r.map((e) => [e, 0])), T = new Map(r.map((e) => [e, 0]));
	for (let e of t) {
		let t = n.get(e.from), r = n.get(e.to);
		if (!t || !r) continue;
		if (t === r) {
			if (w.set(t, (w.get(t) ?? 0) + 1), e.role === "primary") {
				let n = o.get(q(e.from, e.to)) ?? 0;
				T.set(t, (T.get(t) ?? 0) + x(n)), _(t, n);
			}
			continue;
		}
		f.get(t)?.add(r), f.get(r)?.add(t);
		let i = q(e.from, e.to), a = o.get(i) ?? 0, s = 1 / (1 + .05 * a), l = x(a), g = H(t, r);
		if (e.role === "primary") {
			v.add(q(t, r)), p.get(t)?.add(r), p.get(r)?.add(t), u.set(g, (u.get(g) ?? 0) + 1), m.set(g, (m.get(g) ?? 0) + 3 * s);
			let e = q(t, r);
			h.set(e, Math.min(h.get(e) ?? a, a)), _(t, a), _(r, a), d.set(t, (d.get(t) ?? 0) + 1), d.set(r, (d.get(r) ?? 0) + 1), S.set(t, (S.get(t) ?? 0) + l), S.set(r, (S.get(r) ?? 0) + l);
		} else e.role === "return" ? (v.add(q(t, r)), p.get(t)?.add(r), p.get(r)?.add(t), S.set(t, (S.get(t) ?? 0) + l), S.set(r, (S.get(r) ?? 0) + l)) : c.has(i) || (v.add(q(t, r)), p.get(t)?.add(r), p.get(r)?.add(t), e.direction !== "bidirectional" && m.set(g, (m.get(g) ?? 0) + .1 * s), C.set(t, (C.get(t) ?? 0) + l), C.set(r, (C.get(r) ?? 0) + l));
	}
	let E = /* @__PURE__ */ new Set();
	if (a) {
		for (let e of l) {
			let t = d.get(e) ?? 0, n = T.get(e) ?? 0, r = S.get(e) ?? 0, i = C.get(e) ?? 0, a = p.get(e)?.size ?? 0, o = (y.get(e) ?? 0) >= 2 && (w.get(e) ?? 0) === 0 ? i > r : i > (r + n) * 2;
			(t === 0 && a >= 2 || o && a >= 3) && E.add(e);
		}
		if (E.size > 0) {
			let e = r.filter((e) => (f.get(e)?.size ?? 0) > 0 && !E.has(e)).length;
			(u.size === 0 || e < 2) && E.clear();
		}
	}
	let D = new Map(r.map((e) => [e, /* @__PURE__ */ new Set()]));
	for (let e of t) {
		if (e.role !== "primary") continue;
		let t = n.get(e.from), r = n.get(e.to);
		t && r && t !== r && !E.has(t) && !E.has(r) && (J(D, t, r), J(D, r, t));
	}
	let O = [], k = /* @__PURE__ */ new Set();
	for (let e of r) for (let t of r) {
		if (e >= t) continue;
		let n = q(e, t);
		if (k.has(n)) continue;
		k.add(n);
		let r = m.get(H(e, t)) ?? 0, o = m.get(H(t, e)) ?? 0;
		if (r === 0 && o === 0) continue;
		let s = E.has(e), c = E.has(t), l = u.get(H(e, t)) ?? 0, f = u.get(H(t, e)) ?? 0, p = l + f > 0;
		if (a && !s && !c && !p && (d.get(e) ?? 0) > 0 && (d.get(t) ?? 0) > 0 && Y(D, e, t)) continue;
		let _ = e, v = t, y = r - o, b = g.get(e), x = g.get(t);
		if (!s && !c && l > 0 && l === f && b !== void 0 && x !== void 0 && b !== x) x < b ? (_ = t, v = e, y = Math.abs(o - r)) : y = Math.abs(r - o);
		else if (o > r) _ = t, v = e, y = o - r;
		else if (r === o) {
			let n = Y(i, e, t);
			Y(i, t, e) && !n && (_ = t, v = e);
		}
		let S = _ === e ? o : r, C = g.get(_), w = g.get(v);
		if (a && !s && !c && p && S === 0 && C !== void 0 && w !== void 0 && C > w && Y(i, v, _)) continue;
		let T = p ? 100 + 10 / (1 + .05 * (h.get(n) ?? 0)) : 0, A = (s || c ? 0 : 1e3) + T + y;
		O.push({
			a: _,
			b: v,
			weight: A,
			primary: p && !s && !c
		});
	}
	O.sort((e, t) => t.weight - e.weight || mn(e.a, t.a) || mn(e.b, t.b));
	let A = new Map(r.map((e) => [e, []])), j = new Map(r.map((e) => [e, /* @__PURE__ */ new Set()])), M = /* @__PURE__ */ new Set();
	for (let e of O) Y(j, e.b, e.a) || (A.get(e.a)?.push(e.b), J(j, e.a, e.b), e.primary && M.add(H(e.a, e.b)));
	let N = r.filter((e) => !E.has(e)), P = new Map(r.map((e) => [e, 0]));
	for (let e of N) for (let t of A.get(e) ?? []) E.has(t) || P.set(t, (P.get(t) ?? 0) + 1);
	let F = new Map(r.map((e) => [e, 0])), ee = N.filter((e) => (P.get(e) ?? 0) === 0);
	for (let e = 0; e < ee.length; e++) {
		let t = ee[e];
		if (t !== void 0) for (let e of A.get(t) ?? []) {
			if (E.has(e)) continue;
			F.set(e, Math.max(F.get(e) ?? 0, (F.get(t) ?? 0) + 1));
			let n = (P.get(e) ?? 0) - 1;
			P.set(e, n), n === 0 && ee.push(e);
		}
	}
	let I = new Map(F);
	for (let e of N) {
		if ((P.get(e) ?? 0) !== 0 || (A.get(e)?.length ?? 0) !== 0) continue;
		let t = f.get(e);
		if (!t || t.size !== 1) continue;
		let [n] = t;
		n && !E.has(n) && v.has(q(e, n)) && ((I.get(n) ?? 0) > 0 || mn(n, e) < 0) && F.set(e, (I.get(n) ?? 0) + 1);
	}
	let te = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = n.get(e.from), r = n.get(e.to);
		if (!t || !r || t === r) continue;
		let i = o.get(q(e.from, e.to)) ?? 0;
		for (let [e, n] of [[t, r], [r, t]]) {
			if (!E.has(e) || E.has(n)) continue;
			let t = te.get(e);
			t || (t = /* @__PURE__ */ new Map(), te.set(e, t));
			let r = x(i);
			r > (t.get(n) ?? 0) && t.set(n, r);
		}
	}
	for (let e of E) {
		let t = te.get(e);
		if (!t || t.size === 0) continue;
		let n = 0, r = 0;
		for (let [e, i] of t) r += (F.get(e) ?? 0) * i, n += i;
		n > 0 && F.set(e, Math.round(r / n));
	}
	for (let e of N) {
		if ((P.get(e) ?? 0) !== 0 || (A.get(e)?.length ?? 0) !== 0) continue;
		let t = f.get(e);
		if (!t || t.size === 0 || [...t].some((e) => !E.has(e))) continue;
		let n = [...t].filter((t) => (u.get(H(t, e)) ?? 0) > 0), r = [...t].filter((t) => (u.get(H(e, t)) ?? 0) > 0);
		if (n.length > 0) F.set(e, Math.max(...n.map((e) => (F.get(e) ?? 0) + 1)));
		else if (r.length > 0) F.set(e, Math.max(0, Math.min(...r.map((e) => (F.get(e) ?? 0) - 1))));
		else {
			let n = [...t].map((e) => F.get(e) ?? 0);
			F.set(e, Math.round(n.reduce((e, t) => e + t, 0) / n.length));
		}
	}
	return {
		zoneStage: F,
		auxiliaryZones: E,
		primaryZonePairs: M
	};
}
// src/layout/links.ts
function Sn(e) {
	let t = new Set(e.nodes.map((e) => e.id));
	return U(e).filter((e) => e.from !== e.to && t.has(e.from) && t.has(e.to)).map((e) => [e.from, e.to]);
}
function Cn(e, t) {
	return e.flatMap(([e, n]) => {
		let r = t.nodes[e], i = t.nodes[n], a = r ?? t.groups?.[e], o = i ?? t.groups?.[n];
		return !a || !o ? [] : [{
			from: e,
			to: n,
			ax: a.x + a.width / 2,
			ay: r ? a.y + 50 : a.y + a.height / 2,
			bx: o.x + o.width / 2,
			by: i ? o.y + 50 : o.y + o.height / 2
		}];
	});
}
function wn(e, t, n, r, i, a) {
	return Math.sign((n - e) * (a - t) - (r - t) * (i - e));
}
function Tn(e, t) {
	return e.from === t.from || e.from === t.to || e.to === t.from || e.to === t.to;
}
function En(e, t) {
	return wn(e.ax, e.ay, e.bx, e.by, t.ax, t.ay) * wn(e.ax, e.ay, e.bx, e.by, t.bx, t.by) < 0 && wn(t.ax, t.ay, t.bx, t.by, e.ax, e.ay) * wn(t.ax, t.ay, t.bx, t.by, e.bx, e.by) < 0;
}
function Dn(e) {
	let t = 0;
	return e.forEach((n, r) => {
		for (let i = r + 1; i < e.length; i++) {
			let r = e[i];
			r && !Tn(n, r) && En(n, r) && t++;
		}
	}), t;
}
function On(e, t) {
	return Dn(Cn(Sn(e), t));
}
function kn(e, t) {
	return Dn(Cn(e.filter((e) => e.role === "primary").map((e) => [e.from, e.to]), t));
}
// src/layout/ranks.ts
function An(e, t) {
	let n = new Set(e), r = new Map(e.map((e) => [e, []]));
	for (let [e, i] of t) n.has(e) && n.has(i) && e !== i && r.get(e)?.push(i);
	let i = /* @__PURE__ */ new Map(), a = new Map(e.map((e) => [e, []])), o = [];
	for (let t of e) {
		if (i.get(t)) continue;
		let e = [{
			id: t,
			i: 0
		}];
		for (i.set(t, 1); e.length > 0;) {
			let n = e[e.length - 1];
			if (!n) break;
			let s = r.get(n.id) ?? [];
			if (n.i >= s.length) {
				i.set(n.id, 2), e.pop();
				continue;
			}
			let c = s[n.i++];
			if (c === void 0) continue;
			let l = i.get(c) ?? 0;
			if (l === 1) {
				let r = e.slice(e.findIndex((e) => e.id === c)).map((e) => e.id);
				o.push({
					from: n.id,
					to: c,
					loop: r,
					root: t
				});
			} else a.get(n.id)?.push(c), l === 0 && (i.set(c, 1), e.push({
				id: c,
				i: 0
			}));
		}
	}
	let s = new Map(e.map((e) => [e, 0]));
	for (let e of a.values()) for (let t of e) s.set(t, (s.get(t) ?? 0) + 1);
	let c = new Map(e.map((e) => [e, 0])), l = e.filter((e) => s.get(e) === 0);
	for (let e = 0; e < l.length; e++) {
		let t = l[e];
		if (t !== void 0) for (let e of a.get(t) ?? []) {
			c.set(e, Math.max(c.get(e) ?? 0, (c.get(t) ?? 0) + 1));
			let n = (s.get(e) ?? 0) - 1;
			s.set(e, n), n === 0 && l.push(e);
		}
	}
	return {
		rank: c,
		predecessors: jn(a),
		back: o
	};
}
function jn(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of e) for (let e of r) b(t, e, n);
	return t;
}
// src/layout/zoneBlocks.ts
var Mn = 2, Nn = 150, Pn = 80, Fn = 44, In = {
	stageGap: Pn,
	rowGap: Fn,
	horizontalClearance: 60,
	verticalClearance: 34,
	auxGap: 58
}, Ln = {
	stageGap: 48,
	rowGap: 24,
	horizontalClearance: 36,
	verticalClearance: 22,
	auxGap: 32
};
function Rn(e) {
	return V(e.groups).length >= Mn;
}
var zn = q;
function Bn(e, t = U(e)) {
	let n = X(e, t), r = [...n.pairFirstStep.entries()].sort((e, t) => e[0] < t[0] ? -1 : +(e[0] > t[0]));
	return [
		t.filter((e) => e.from !== e.to).map((e) => [e.from, e.to]),
		n.connections.map((e) => [
			e.from,
			e.to,
			e.role,
			e.direction
		]),
		n.forwardEdges,
		[...n.zoneStage.entries()],
		[...n.auxiliaryZones],
		[n.activeStepCount >= 4, ...r]
	];
}
function Vn(e) {
	let t = U(e), n = [...new Set(t.filter((e) => e.from === e.to).map((e) => e.from))].sort(), r = Hn(e);
	return JSON.stringify([
		e.nodes.map((e) => [
			e.id,
			e.parentId ?? "",
			e.mount ?? ""
		]),
		e.groups.map((e) => [e.id, e.parentId ?? ""]),
		n,
		Bn(e, t),
		...r === e ? [] : [Bn(r)]
	]);
}
function Hn(e) {
	let t = Gn(e), n = /* @__PURE__ */ new Set([...e.nodes.map((e) => e.id), ...e.groups.map((e) => e.id)]), r = /* @__PURE__ */ new Set();
	for (let i of U(e)) {
		if (i.from === i.to || !n.has(i.from) || !n.has(i.to)) continue;
		let e = t.get(i.from) ?? i.from, a = t.get(i.to) ?? i.to;
		e !== a && (r.add(e), r.add(a));
	}
	if (r.size === 0) return e;
	let i = V(e.groups).every((e) => r.has(e.id)), a = e.nodes.every((e) => r.has(t.get(e.id) ?? e.id));
	if (i && a) return e;
	let o = Rt(e.groups), s = e.groups.filter((e) => r.has(o.get(e.id) ?? e.id)), c = e.nodes.filter((e) => r.has(t.get(e.id) ?? e.id)), l = new Set(c.map((e) => e.id)), u = /* @__PURE__ */ new Set([...l, ...s.map((e) => e.id)]), d = e.steps.map((e) => ({
		...e,
		animations: e.animations.filter((e) => l.has(e.from) && l.has(e.to)),
		statics: e.statics.filter((e) => u.has(e.from) && u.has(e.to))
	}));
	return {
		...e,
		groups: s,
		nodes: c,
		steps: d
	};
}
function Un(e) {
	return {
		...e,
		steps: e.steps.map((e) => ({
			...e,
			statics: e.statics.map(({ label: e, ...t }) => t)
		}))
	};
}
function Wn(e, t) {
	if (e.parentId !== t) return e;
	let { parentId: n, ...r } = e;
	return r;
}
function Gn(e) {
	let t = Rt(e.groups), n = zt(e), r = /* @__PURE__ */ new Map();
	for (let n of e.groups) r.set(n.id, t.get(n.id) ?? n.id);
	for (let i of e.nodes) {
		let e = n.get(i.id);
		r.set(i.id, e !== void 0 && t.has(e) ? e : i.id);
	}
	return r;
}
function Kn(e) {
	let t = Gn(e);
	return U(e).filter((e) => {
		let n = t.get(e.from), r = t.get(e.to);
		return n !== void 0 && r !== void 0 && n !== r;
	}).length;
}
function qn(e, t, n, r, i, a) {
	let o = /* @__PURE__ */ new Map(), s = a.get(e);
	s && o.set(e, s);
	let c = /* @__PURE__ */ new Map(), l = (e, s) => {
		let u = t.filter((t) => t.parentId === e), d = n.filter((t) => t.parentId === e), f = [], p = [];
		for (let e of u) {
			let t = i.get(e.id);
			t && (f.push(t.y - r), p.push(t.y + t.height));
		}
		for (let e of d) {
			let t = a.get(e.id);
			t && (f.push(t.y), p.push(t.y + t.height));
		}
		if (f.length === 0) return;
		let m = Math.min(...f), h = Math.max(...p), g = m + s, _ = g + h + r;
		for (let e of u) c.set(e.id, _);
		for (let e of d) {
			let t = a.get(e.id);
			if (!t) continue;
			let n = g + (h - (t.y + t.height));
			o.set(e.id, {
				...t,
				y: n
			}), l(e.id, n - t.y);
		}
	};
	return l(void 0, 0), {
		groupsFlipped: o,
		reflectConst: c
	};
}
function Jn(e, t, n, r) {
	let i = n.connections.filter((t) => e.has(t.from) && e.has(t.to)), a = i.filter((e) => e.role === "primary"), o = i.filter((e) => e.role === "static"), s = /* @__PURE__ */ new Set();
	for (let e of t) e.direction === "bidirectional" && s.add(zn(e.from, e.to));
	let c = /* @__PURE__ */ new Map(), l = [...e].map((e) => r.get(e)).find((e) => e !== void 0), u = l === void 0 ? 0 : n.zoneStage.get(l) ?? 0;
	for (let t of n.connections) {
		let i = e.has(t.from);
		if (i === e.has(t.to)) continue;
		let a = i ? t.to : t.from, o = r.get(a) ?? a, s = (n.zoneStage.get(o) ?? u) - u, l = t.role === "primary" ? 3 : t.role === "static" ? 1 : .2, d = i ? t.from : t.to, f = s === 0 ? i ? 1 : -1 : Math.sign(s);
		c.set(d, (c.get(d) ?? 0) + f * l);
	}
	let d = [];
	if (a.length === 0) for (let e of o) {
		let t = zn(e.from, e.to);
		n.egressReturnPairs?.has(t) || (s.has(t) && (c.get(e.from) ?? 0) > (c.get(e.to) ?? 0) ? d.push([e.to, e.from]) : d.push([e.from, e.to]));
	}
	else {
		let e = /* @__PURE__ */ new Map(), t = (t, n) => {
			let r = e.get(t);
			r || (r = /* @__PURE__ */ new Set(), e.set(t, r)), r.add(n);
		};
		for (let e of a) t(e.from, e.to), d.push([e.from, e.to]);
		for (let r of o) {
			if (vn(r.from, r.to, n)) continue;
			let i = zn(r.from, r.to), a = r.from, o = r.to;
			s.has(i) && (c.get(a) ?? 0) > (c.get(o) ?? 0) && (a = r.to, o = r.from), Y(e, o, a) || (t(a, o), d.push([a, o]));
		}
	}
	return {
		connections: i,
		byPair: /* @__PURE__ */ new Map(),
		forwardEdges: d,
		hasAnimate: a.length > 0 || i.some((e) => e.role === "return"),
		zoneStage: /* @__PURE__ */ new Map(),
		auxiliaryZones: /* @__PURE__ */ new Set(),
		primaryZonePairs: /* @__PURE__ */ new Set(),
		pairFirstStep: /* @__PURE__ */ new Map(),
		activeStepCount: 0
	};
}
function Yn(e, t, n, r, i = Rt(e.groups), a = Gn(e), o = X(e), s, c = !1, l = 0) {
	let u = e.nodes.filter((e) => a.get(e.id) === t).map((e) => Wn(e, t)), d = e.groups.filter((e) => e.id !== t && i.get(e.id) === t).map((e) => Wn(e, t));
	if (s && d.length > 0 && !r) return s(e, t, n, o, c, l);
	let f = e.groups.find((e) => e.id === t)?.label ?? "", p = new Set(u.map((e) => e.id)), m = U(e).filter((e) => p.has(e.from) && p.has(e.to)), h = e.steps.map((e) => ({
		...e,
		animations: e.animations.filter((e) => p.has(e.from) && p.has(e.to)),
		statics: e.statics.filter((e) => p.has(e.from) && p.has(e.to))
	})), g = Xt({ steps: h }), _ = Math.max(0, ...g.values()), v = (e, n) => [t, {
		x: 0,
		y: 0,
		width: e,
		height: n
	}];
	if (u.length === 0 && d.length === 0) {
		let e = Gt.width + 32, n = Math.max(e, Jt(f)), r = Yt(f, n) + 16 + _, i = r + Gt.height + 16, a = new Map([v(n, i)]);
		return {
			id: t,
			width: n,
			height: i,
			head: r,
			contentHeight: Gt.height,
			loopRoom: _,
			nodeLoopRoom: g,
			flippable: !1,
			nodes: /* @__PURE__ */ new Map(),
			groups: a,
			groupsFlipped: new Map(a),
			reflectConst: /* @__PURE__ */ new Map()
		};
	}
	let y = n({
		...e,
		nodes: u,
		groups: d,
		steps: h
	}, r, m, Jn(p, m, o, a)), b = Zt([...Object.values(y.nodes), ...Object.values(y.groups)]), x = b.width + 32, S = Math.max(x, Jt(f)), C = 16 + Math.round((S - x) / 2), w = Yt(f, S) + 16 + _, T = b.height, E = w + T + 16, D = (e) => ({
		...e,
		x: e.x - b.x + C,
		y: e.y - b.y + w
	}), O = new Map(Object.entries(y.nodes).map(([e, t]) => [e, D(t)])), k = new Map([v(S, E), ...Object.entries(y.groups).map(([e, t]) => [e, D(t)])]), { groupsFlipped: A, reflectConst: j } = qn(t, u, d, _, O, k);
	return {
		id: t,
		width: S,
		height: E,
		head: w,
		contentHeight: T,
		loopRoom: _,
		nodeLoopRoom: g,
		flippable: _ === 0 && d.length === 0,
		nodes: O,
		groups: k,
		groupsFlipped: A,
		reflectConst: j
	};
}
function Xn(e, t, n, r = X(e), i) {
	let a = Rt(e.groups), o = Gn(e), s = Xt(e), c = Hn(e), l = c === e ? null : new Set(V(c.groups).map((e) => e.id)), u = c === e ? r : X(c, U(c)), d = [];
	for (let s of V(e.groups)) {
		let c = l === null || l.has(s.id) ? u : r;
		d.push(Yn(e, s.id, t, n?.get(s.id), a, o, c, i, c.auxiliaryZones.has(s.id), 0));
	}
	for (let t of e.nodes) {
		if (o.get(t.id) !== t.id) continue;
		let { width: e, height: n } = W, r = s.get(t.id) ?? 0;
		d.push({
			id: t.id,
			width: e,
			height: n,
			head: 0,
			contentHeight: n,
			loopRoom: r,
			nodeLoopRoom: r > 0 ? /* @__PURE__ */ new Map([[t.id, r]]) : /* @__PURE__ */ new Map(),
			flippable: !1,
			nodes: /* @__PURE__ */ new Map([[t.id, {
				x: 0,
				y: 0,
				width: e,
				height: n
			}]]),
			groups: /* @__PURE__ */ new Map(),
			groupsFlipped: /* @__PURE__ */ new Map(),
			reflectConst: /* @__PURE__ */ new Map()
		});
	}
	return {
		blocks: d,
		owners: o
	};
}
var Zn = (e, t) => e < t ? -1 : +(e > t);
function Qn(e, t, n) {
	let r = n;
	if (!r) {
		let t = /* @__PURE__ */ new Map();
		for (let n of e) for (let e of n.nodes.keys()) t.set(e, n.id);
		r = t;
	}
	let i = /* @__PURE__ */ new Set();
	for (let e of t.connections) {
		let t = r.get(e.from) ?? e.from, n = r.get(e.to) ?? e.to;
		t !== n && (i.add(t), i.add(n));
	}
	let a = [], o = [];
	for (let t of e) i.has(t.id) ? a.push(t) : o.push(t);
	return {
		connected: a,
		isolated: o
	};
}
function $n(e, t, n = In) {
	if (e.length === 0) return [];
	let r = [...e].sort((e, t) => Zn(e.id, t.id)), i = 0, a = 0, o = 1800;
	if (t.length > 0) {
		let e = Infinity, r = -Infinity, s = -Infinity;
		for (let n of t) e = Math.min(e, n.x), r = Math.max(r, n.x + n.block.width), s = Math.max(s, n.y + n.block.height);
		i = e, a = s + n.rowGap, o = Math.max(1800, r - e);
	}
	let s = [], c = i, l = a;
	for (let e of r) {
		c > i && c + e.width > i + o && (c = i, a = l + n.rowGap, l = a);
		let t = e.groups.size === 0 ? e.loopRoom : 0, r = a + t;
		s.push({
			block: e,
			x: c,
			y: r,
			flip: 0
		}), l = Math.max(l, r + e.height), c += e.width + n.horizontalClearance;
	}
	return s;
}
function er(e, t) {
	let n = e.filter((e) => !t.auxiliaryZones.has(e.id)), r = e.filter((e) => t.auxiliaryZones.has(e.id));
	return n.length === 0 && (n.push(...r), r.length = 0), {
		primary: n,
		auxiliary: r,
		columns: [...new Set(n.map((e) => t.zoneStage.get(e.id) ?? 0))].sort((e, t) => e - t).map((e) => n.filter((n) => (t.zoneStage.get(n.id) ?? 0) === e).sort((e, t) => Zn(e.id, t.id)))
	};
}
function tr(e, t) {
	if (!t.hasAnimate) return !1;
	let { connected: n, isolated: r } = Qn(e, t);
	if (n.length === 0) return !1;
	if (r.length > 0) {
		let e = new Set(n.flatMap((e) => [...e.nodes.keys()]));
		if (!t.connections.some((t) => t.role !== "static" && e.has(t.from) && e.has(t.to))) return !1;
	}
	let { auxiliary: i, columns: a } = er(n, t);
	if (a.length === 0) return !0;
	let o = a.reduce((e, t) => e + Math.max(...t.map((e) => e.width)), Math.max(0, a.length - 1) * Pn), s = Math.max(0, ...a.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * Fn));
	if (a.length >= 6 && o / Math.max(1, s) > 5.8) return !1;
	let c = s + (i.length > 0 ? Math.max(...i.map((e) => e.height)) + 34 + 24 : 0), l = a.length <= 3 ? 16 : 10;
	return o / Math.max(1, c) <= l;
}
var nr = 1.6;
function rr(e, t, n = 60, r = 34) {
	for (let i of t) if (i !== e && e.x < i.x + i.block.width + n && i.x < e.x + e.block.width + n && e.y < i.y + i.block.height + r && i.y < e.y + e.block.height + r) return !1;
	return !0;
}
function ir(e, t) {
	if (t) return t;
	let n = /* @__PURE__ */ new Map();
	for (let t of e) for (let e of t) for (let t of e.nodes.keys()) n.set(t, e.id);
	return n;
}
function ar(e, t, n) {
	if (t.hasAnimate || !e.some((e) => e.length >= 4)) return e.map((e) => [...e]);
	let r = ir(e, n), i = /* @__PURE__ */ new Map();
	for (let e of t.connections) {
		let t = r.get(e.from) ?? e.from, n = r.get(e.to) ?? e.to;
		t !== n && (i.set(t, (i.get(t) ?? 0) + 1), i.set(n, (i.get(n) ?? 0) + 1));
	}
	let a = (e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * Fn, o = (e) => e.length === 0 ? 0 : Math.max(...e.map((e) => e.width)), s = e.filter((e) => e.length < 4), c = s.reduce((e, t) => e + o(t) + Nn, 0), l = Math.max(0, ...s.map(a)), u = (e, t) => {
		let n = [], r = Math.floor(e.length / t), i = e.length % t, a = 0;
		for (let o = 0; o < t; o++) {
			let t = r + +(o < i);
			n.push(e.slice(a, a + t)), a += t;
		}
		return n;
	}, d = [];
	for (let t of e) {
		if (t.length < 4) {
			d.push([...t]);
			continue;
		}
		let e = [...t].sort((e, t) => (i.get(t.id) ?? 0) - (i.get(e.id) ?? 0) || t.nodes.size - e.nodes.size || Zn(e.id, t.id)), n = Math.min(e.length, Math.max(2, Math.ceil(Math.sqrt(e.length)) + 1)), r = u(e, 2), s = Infinity;
		for (let t = 2; t <= n; t++) {
			let n = u(e, t), i = c + n.reduce((e, t) => e + o(t), Math.max(0, n.length - 1) * Nn), d = Math.max(l, ...n.map(a)), f = Math.abs(Math.log(Math.max(.01, i / Math.max(1, d)) / nr));
			f < s - 1e-9 && (s = f, r = n);
		}
		d.push(...r);
	}
	return d;
}
function or(e, t, n) {
	if (e.length === 0) return [];
	let r = ar(e, t, n), i = r.reduce((e, t) => e + (t.length === 0 ? 0 : Math.max(...t.map((e) => e.width))), Math.max(0, r.length - 1) * Nn), a = r.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * Fn).reduce((e, t) => e + t, 0) / Math.max(1, r.length) + 34 + 24, o = Math.max(1600, Math.sqrt(i * 3 * a)), s = [[]], c = 0;
	for (let e of r) {
		if (e.length === 0) continue;
		let t = Math.max(...e.map((e) => e.width)), n = s[s.length - 1];
		n.length > 0 && c + Nn + t > o ? (s.push([e]), c = t) : (n.length > 0 && (c += Nn), n.push(e), c += t);
	}
	return s.filter((e) => e.length > 0);
}
function sr(e, t, n) {
	if (e.length === 0) return {
		rows: [],
		wrapped: !1,
		auxiliary: [],
		rowOfBlock: /* @__PURE__ */ new Map()
	};
	let { auxiliary: r, columns: i } = er(e, t), a = /* @__PURE__ */ new Map();
	if (tr(e, t)) {
		let e = i.length > 0 ? [i] : [];
		for (let e of i) for (let t of e) a.set(t.id, 0);
		return {
			rows: e,
			wrapped: !1,
			auxiliary: r,
			rowOfBlock: a
		};
	}
	let o = or(i, t, n);
	return o.forEach((e, t) => {
		for (let n of e) for (let e of n) a.set(e.id, t);
	}), {
		rows: o,
		wrapped: !0,
		auxiliary: r,
		rowOfBlock: a
	};
}
function cr(e, t, n, r = X(e)) {
	let { connected: i, isolated: a } = Qn(t, r, n), o = /* @__PURE__ */ new Map();
	if (i.length === 0) {
		for (let e of $n(a, [])) o.set(e.block.id, {
			x: e.x,
			y: e.y
		});
		return o;
	}
	let s = a.length > 0 ? Hn(e) : e, c = s === e ? r : X(s), l = new Map(i.map((e) => [e.id, e])), u = sr(i, c, n), d = [];
	if (u.wrapped) {
		let e = 0;
		for (let t of u.rows) {
			let n = t.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * Fn), r = Math.max(0, ...n), i = 0;
			t.forEach((t, a) => {
				let s = e + (r - (n[a] ?? 0)) / 2;
				for (let e of t) o.set(e.id, {
					x: i,
					y: s
				}), d.push({
					block: e,
					x: i,
					y: s,
					flip: 0
				}), s += e.height + Fn;
				i += Math.max(...t.map((e) => e.width)) + Nn;
			}), e += r + 34 + 24;
		}
	} else {
		let e = u.rows[0] ?? [], t = /* @__PURE__ */ new Map();
		for (let e of c.connections) {
			if (e.role === "return") continue;
			let r = n.get(e.from), i = n.get(e.to);
			if (!r || !i || r === i) continue;
			let a = t.get(i);
			a ? a.push(r) : t.set(i, [r]);
		}
		let r = (e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * Fn, i = Math.max(0, ...e.map(r)), a = 0;
		for (let n of e) {
			n.sort((e, n) => {
				let r = (e) => {
					let n = (t.get(e) ?? []).flatMap((e) => {
						let t = o.get(e), n = l.get(e);
						return t && n ? [t.y + n.height / 2] : [];
					});
					return n.length > 0 ? n.reduce((e, t) => e + t, 0) / n.length : Infinity;
				};
				return r(e.id) - r(n.id) || Zn(e.id, n.id);
			});
			let e = (i - r(n)) / 2;
			for (let t of n) o.set(t.id, {
				x: a,
				y: e
			}), d.push({
				block: t,
				x: a,
				y: e,
				flip: 0
			}), e += t.height + Fn;
			a += Math.max(...n.map((e) => e.width)) + Pn;
		}
	}
	if (u.auxiliary.length > 0) {
		let e = u.auxiliary.map((e) => ({
			block: e,
			x: 0,
			y: 0,
			flip: 0
		}));
		ur(e, d, n, c);
		for (let t of e) o.set(t.block.id, {
			x: t.x,
			y: t.y
		});
	}
	if (a.length > 0) {
		let e = i.map((e) => {
			let t = o.get(e.id) ?? {
				x: 0,
				y: 0
			};
			return {
				block: e,
				x: t.x,
				y: t.y,
				flip: 0
			};
		});
		for (let t of $n(a, e)) o.set(t.block.id, {
			x: t.x,
			y: t.y
		});
	}
	return o;
}
function lr(e, t, n, r, i, a, o = In) {
	let s = [], c = -Infinity;
	for (let t of e) {
		let { placed: e, cx: r, maxRight: i } = t, l = r - e.block.width / 2, u = s[s.length - 1], d = Math.max(l, c + o.horizontalClearance);
		!u || u.items.length > 0 && (d - n + e.block.width > a || d + e.block.width > i + 1) ? (s.push({
			items: [{
				placed: e,
				x: l
			}],
			height: e.block.height
		}), c = l + e.block.width) : (u.items.push({
			placed: e,
			x: d
		}), u.height = Math.max(u.height, e.block.height), c = d + e.block.width);
	}
	let l = t ? r - o.auxGap : i + o.auxGap;
	for (let e of s) {
		for (let { placed: n, x: r } of e.items) n.x = r, n.y = t ? l - n.block.height : l;
		l = t ? l - e.height - o.rowGap : l + e.height + o.rowGap;
	}
}
function ur(e, t, n, r, i) {
	if (e.length === 0) return [];
	let a = i?.auxMode ?? "bands", o = i?.sideMode ?? "stationY", s = i?.clampMaxSource ?? !1, c = i?.decayStatic ?? !1, l = i?.spacing ?? In, u = i?.rowFracOf, d = i?.cols, f = Infinity, p = -Infinity, m = Infinity, h = -Infinity;
	for (let e of t) f = Math.min(f, e.x), p = Math.max(p, e.x + e.block.width), m = Math.min(m, e.y), h = Math.max(h, e.y + e.block.height);
	let g = Number.isFinite(f), _ = g ? (f + p) / 2 : 0, v = g ? (m + h) / 2 : 0, y = g ? m : 0, b = g ? h : 0, x = Math.max(g ? p - f : 1600, 1600) + 400, S = g ? f : 0, C = new Map(e.map((e) => [e.block.id, e])), w = new Map(t.map((e) => [e.block.id, e])), T = (e) => {
		let t = 0, i = 0, a = 0, l = 0, d = -Infinity, f = Infinity, p = Infinity, m = C.get(e);
		for (let h of r.connections) {
			let g = n.get(h.from) ?? h.from, _ = n.get(h.to) ?? h.to;
			if (g === _ || g !== e && _ !== e) continue;
			let v = g === e ? _ : g;
			if (r.auxiliaryZones.has(v)) continue;
			let y = w.get(v);
			if (!y) continue;
			let b = g === e ? h.to : h.from, x = g === e ? h.from : h.to, S = y.block.nodes.get(b), C = y.x + (S ? S.x + S.width / 2 : y.block.width / 2), T = r.pairFirstStep.get(q(h.from, h.to)) ?? 0, E = h.role === "primary" ? 3 / (1 + .08 * T) : h.role === "return" ? 1 / (1 + .08 * T) : c ? (r.hasAnimate ? .06 : .5) / (1 + .35 * T) : .5 / (1 + .08 * T);
			if (t += C * E, o === "rowFrac") {
				let e = S ? ((y.flip ? Z(y.block, S, b) : S.y) / Math.max(1, y.block.height) - .5) * .12 : 0, t = (u?.get(v) ?? .5) + e;
				a += t * E;
			} else {
				let e = y.y + (S ? (y.flip ? Z(y.block, S, b) : S.y) + 50 : y.block.height / 2);
				i += e * E;
			}
			if (l += E, h.role === "primary" && m) {
				let t = m.block.nodes.get(x);
				if (t) {
					let n = t.x + t.width / 2;
					_ === e ? d = Math.max(d, C + 24 - n + m.block.width / 2) : (p = Math.min(p, T), s && (f = Math.min(f, C - 24 - n + m.block.width / 2)));
				}
			}
		}
		let h = l > 0 ? t / l : _, g = s && d <= f ? Math.min(f, Math.max(h, d)) : Math.max(h, d), y = o === "rowFrac" ? (l > 0 ? a / l : .5) < .42 ? "above" : "below" : (l > 0 ? i / l : v) < v - 1e-6 ? "above" : "below";
		return {
			meanX: h,
			minOutPriStep: p,
			cx: g,
			maxRight: s && Number.isFinite(f) ? f + (m?.block.width ?? 0) / 2 : Infinity,
			side: y
		};
	}, E = new Map(e.map((e) => [e.block.id, T(e.block.id)])), D = [...e].sort((e, t) => (E.get(e.block.id)?.cx ?? _) - (E.get(t.block.id)?.cx ?? _) || Zn(e.block.id, t.block.id)), O = a === "right-top" && g ? D.filter((e) => {
		let t = E.get(e.block.id);
		return t !== void 0 && t.minOutPriStep > 1 && t.meanX >= _;
	}) : [], k = new Set(O), A = O.length > 0 ? D.filter((e) => !k.has(e)) : D;
	if (O.length > 0 && g) {
		let e = d?.[d.length - 1], n = e?.length === 1 && e[0] ? w.get(e[0].id) : void 0;
		if (n && O.length === 1 && O[0]) {
			let e = O[0], r = n.x, i = n.y, a = e.block.height + Fn + n.block.height, o = (m + h) / 2, s = n.x;
			for (let e of t) e !== n && (s = Math.max(s, e.x + e.block.width + Pn));
			e.x = s, n.x = s, e.y = o - a / 2, n.y = e.y + e.block.height + Fn;
			let c = [...t, e];
			rr(e, c) && rr(n, c) || (n.x = r, n.y = i, e.x = p + Pn, e.y = o - e.block.height / 2);
		} else {
			let e = O.reduce((e, t) => e + t.block.height, 0) + Math.max(0, O.length - 1) * Fn, t = (m + h - e) / 2, n = p + Pn;
			for (let e of O) e.x = n, e.y = t, t += e.block.height + Fn;
		}
		let r = p;
		for (let e of t) y = Math.min(y, e.y), b = Math.max(b, e.y + e.block.height), r = Math.max(r, e.x + e.block.width);
		for (let e of O) y = Math.min(y, e.y), b = Math.max(b, e.y + e.block.height), r = Math.max(r, e.x + e.block.width);
		x = Math.max(r - f, 1600) + 400;
	}
	if (A.length > 0) {
		let e = (e) => e.map((e) => {
			let t = E.get(e.block.id);
			return {
				placed: e,
				cx: t?.cx ?? _,
				maxRight: t?.maxRight ?? Infinity
			};
		});
		lr(e(A.filter((e) => E.get(e.block.id)?.side === "above")), !0, S, y, b, x, l), lr(e(A.filter((e) => E.get(e.block.id)?.side !== "above")), !1, S, y, b, x, l);
	}
	return D;
}
function Z(e, t, n) {
	let r = e.reflectConst.get(n);
	return r === void 0 ? e.head + e.contentHeight - (t.y - e.head) - t.height : r - t.y - t.height;
}
function dr(e) {
	let t = [...e].sort((e, t) => e.x - t.x);
	t.forEach((e, n) => {
		for (let r of t.slice(0, n)) e.y < r.y + r.block.height + 34 && r.y < e.y + e.block.height + 34 && (e.x = Math.max(e.x, r.x + r.block.width + 60));
	});
}
function fr(e, t, n) {
	let r = new Map(n.map((e, t) => [e, t])), i = /* @__PURE__ */ new Map();
	for (let n of t.nodes.entries()) {
		let [t, r] = n, a = `${e.get(t) ?? ""}|${Math.round(r.x)}`, o = i.get(a);
		o ? o.push(n) : i.set(a, [n]);
	}
	for (let e of i.values()) {
		if (e.length < 2) continue;
		let t = e.map(([, e]) => e.y).sort((e, t) => e - t);
		e.sort((e, t) => (r.get(e[0]) ?? 0) - (r.get(t[0]) ?? 0)), e.forEach(([, e], n) => {
			e.y = t[n];
		});
	}
}
function pr(e, t, n, r) {
	let i = Lt(e.nodes), a = /* @__PURE__ */ new Map();
	for (let [e, n] of t) n.ranks && a.set(e, new Map(Object.entries(n.ranks)));
	let o = X(e), { blocks: s, owners: c } = Xn(e, n, a, o, r), { connected: l, isolated: u } = Qn(s, o, c), d = l.map((e) => {
		let n = t.get(e.id);
		return n?.order && fr(i, e, n.order), {
			block: e,
			x: n?.x ?? 0,
			y: n?.y ?? 0,
			flip: n?.flip ?? 0
		};
	});
	return dr(d), mr([...d, ...$n(u, d)]);
}
function mr(e) {
	if (e.length === 0) return {
		nodes: K(),
		groups: K()
	};
	let t = Math.min(...e.map((e) => e.x)), n = Math.min(...e.map((e) => e.y)), r = K(), i = K();
	for (let a of e) {
		let e = Math.round(a.x - t + G.x), o = Math.round(a.y - n + G.y), { block: s } = a;
		for (let [t, n] of s.nodes) r[t] = {
			...n,
			x: e + n.x,
			y: o + (a.flip ? Z(s, n, t) : n.y)
		};
		for (let [t, n] of a.flip ? s.groupsFlipped : s.groups) i[t] = {
			...n,
			x: e + n.x,
			y: o + n.y
		};
	}
	return {
		nodes: r,
		groups: i
	};
}
// src/layout/straightenNodes.ts
var hr = 60, gr = 12, _r = 14, vr = 28, yr = 4, br = (e) => ({
	x: e.x + e.width / 2,
	y: e.y + 50
}), xr = (e, t, n) => e.x < t.x + t.width + n && t.x < e.x + e.width + n && e.y < t.y + t.height + n && t.y < e.y + e.height + n;
function Sr(e, t) {
	let n = K();
	for (let [e, r] of Object.entries(t.nodes)) n[e] = { ...r };
	let { groups: r } = t, i = Xt(e), a = new Map(e.nodes.map((e) => [e.id, e.parentId])), o = new Map(e.groups.map((e) => [e.id, e.parentId])), s = new Map(e.groups.map((e) => [e.id, e.label])), c = X(e), l = Gn(e), u = Sn(e), d = /* @__PURE__ */ new Map();
	for (let e of u) for (let t of new Set(e)) d.set(t, [...d.get(t) ?? [], e]);
	let f = (e, t) => {
		let n = i.get(e) ?? 0;
		return {
			x: t.x,
			y: t.y - n,
			width: t.width,
			height: t.height + n
		};
	}, p = ([e, t]) => {
		let r = br(n[e]), i = br(n[t]);
		return {
			from: e,
			to: t,
			ax: r.x,
			ay: r.y,
			bx: i.x,
			by: i.y
		};
	}, m = (e) => {
		let t = p(e);
		if (Math.abs(t.ay - t.by) > gr && Math.abs(t.ax - t.bx) >= .5) return !1;
		let r = {
			x: Math.min(t.ax, t.bx) - 1,
			y: Math.min(t.ay, t.by) - 1,
			width: Math.abs(t.ax - t.bx) + 2,
			height: Math.abs(t.ay - t.by) + 2
		};
		for (let t in n) if (t !== e[0] && t !== e[1] && xr(f(t, n[t]), r, 0)) return !1;
		return !0;
	}, h = (e) => [...new Set(e.flatMap((e) => d.get(e) ?? []))], g = (e) => e.filter((e) => m(e)).length, _ = (e) => {
		let t = 0;
		for (let n of e) {
			let e = p(n);
			for (let r of u) {
				if (r === n) continue;
				let i = p(r);
				!Tn(e, i) && En(e, i) && t++;
			}
		}
		return t;
	}, v = (e, t) => {
		let i = f(e, t), c = a.get(e), l = c ? r[c] : void 0, u = c && l ? Yt(s.get(c) ?? "", l.width) : 0;
		if (l && (i.x < l.x + 16 || i.x + i.width > l.x + l.width - 16 || i.y < l.y + u + 16 || i.y + i.height > l.y + l.height - 16)) return !1;
		for (let t in n) if (t !== e && xr(i, f(t, n[t]), _r)) return !1;
		let d = /* @__PURE__ */ new Set();
		for (let e = c; e; e = o.get(e)) d.add(e);
		for (let e in r) if (!d.has(e) && xr(i, r[e], vr)) return !1;
		return !0;
	}, y = (e, t, r) => {
		for (let i of e) {
			let e = n[i];
			e.x += t, e.y += r;
		}
	}, b = (e, t, r) => {
		let i = e.map((e) => ({ ...n[e] })), a = () => {
			e.forEach((e, t) => {
				n[e] = { ...i[t] };
			});
		}, o = h(e), s = [];
		if (t !== 0) for (let e of o) {
			let t = c.byPair.get(q(e[0], e[1]));
			if (t?.role === "primary" && l.get(t.from) !== l.get(t.to)) {
				let e = br(n[t.to]).x - br(n[t.from]).x;
				s.push({
					from: t.from,
					to: t.to,
					linkDx: e
				});
			}
		}
		let u = g(o);
		if (y(e, t, r), s.some(({ from: e, to: t, linkDx: r }) => {
			let i = br(n[t]).x - br(n[e]).x;
			return r > 0 ? i <= 0 : i < r;
		}) || !e.every((e) => v(e, n[e]))) return a(), 0;
		let d = g(o) - u;
		if (d <= 0) return a(), 0;
		let f = _(o);
		return a(), f > _(o) ? 0 : d;
	}, x = (e, t) => {
		let r = br(n[e]), i = [e];
		for (let a of d.get(e) ?? []) {
			let o = a[0] === e ? a[1] : a[0], s = br(n[o]);
			(t === 0 ? Math.abs(s.y - r.y) <= gr : Math.abs(s.x - r.x) < .5) && !i.includes(o) && m(a) && i.push(o);
		}
		return i;
	};
	for (let t = 0; t < yr; t++) {
		let t = !1;
		for (let { id: r } of e.nodes) {
			let e = n[r];
			if (!e) continue;
			let i = [];
			for (let t of d.get(r) ?? []) {
				let a = br(e), o = br(n[t[0] === r ? t[1] : t[0]]), s = o.y - a.y, c = o.x - a.x;
				Math.abs(s) > gr && Math.abs(s) <= hr && i.push({
					dx: 0,
					dy: s
				}), Math.abs(c) >= .5 && Math.abs(c) <= hr && i.push({
					dx: c,
					dy: 0
				});
			}
			let a;
			for (let { dx: e, dy: t } of i) {
				let n = x(r, e);
				for (let i of n.length > 1 ? [[r], n] : [[r]]) {
					let n = b(i, e, t), r = Math.abs(e) + Math.abs(t);
					n > 0 && (!a || n > a.gain || n === a.gain && i.length < a.ids.length || n === a.gain && i.length === a.ids.length && r < a.distance) && (a = {
						ids: i,
						dx: e,
						dy: t,
						gain: n,
						distance: r
					});
				}
			}
			a && (y(a.ids, a.dx, a.dy), t = !0);
		}
		if (!t) break;
	}
	return {
		nodes: n,
		groups: r
	};
}
// src/layout/columns.ts
var Cr = 36, wr = 14, Tr = 28, Er = 16, Dr = 4, Or = 500, kr = 44;
function Ar(e, t = jr) {
	if (e.nodes.length === 0 && e.groups.length === 0) return {
		nodes: K(),
		groups: K()
	};
	let n = V(e.groups), r = n.length === 1 ? n[0]?.id : void 0, i = Gn(e), a = U(e), o = new Set(e.nodes.map((e) => e.id)), s = new Map(e.nodes.map((e, t) => [e.id, t])), c = [], l = /* @__PURE__ */ new Set();
	r !== void 0 && (c.push(r), l.add(r));
	for (let t of e.nodes) {
		let e = i.get(t.id) ?? t.id;
		l.has(e) || (c.push(e), l.add(e));
	}
	let u = new Map(c.map((e) => [e, /* @__PURE__ */ new Set()]));
	for (let e of a) {
		if (e.from === e.to || !o.has(e.from) || !o.has(e.to)) continue;
		let t = i.get(e.from) ?? e.from, n = i.get(e.to) ?? e.to;
		t !== n && (u.get(t)?.add(n), u.get(n)?.add(t));
	}
	let d = /* @__PURE__ */ new Set(), f = [];
	for (let e of c) {
		if (d.has(e)) continue;
		let t = [], n = [e];
		d.add(e);
		for (let e = 0; e < n.length; e++) {
			let r = n[e];
			if (r !== void 0) {
				t.push(r);
				for (let e of u.get(r) ?? []) d.has(e) || (d.add(e), n.push(e));
			}
		}
		f.push(t);
	}
	let p, m, h, g = [], _ = [];
	if (r !== void 0) for (let e of f) e.includes(r) ? m = e : e.length >= 2 ? g.push(e) : e[0] !== void 0 && _.push(e[0]);
	else for (let e of f) e.length >= 2 ? g.push(e) : e[0] !== void 0 && _.push(e[0]);
	if (((e) => {
		let t = (e) => Math.min(...e.map((e) => s.get(e) ?? 2 ** 53 - 1));
		e.sort((e, n) => t(e) - t(n));
	})(g), m === void 0 ? g.length > 0 && (p = g.shift()) : m.length >= 2 || g.length === 0 ? p = m : (p = g.shift(), h = r), h === void 0 && g.length === 0 && (_.length === 0 || p === void 0 && _.length <= 1)) return Sr(e, t(e));
	let v = (t, n) => ({
		...e,
		nodes: e.nodes.filter((e) => t.has(e.id)),
		groups: n ? e.groups : [],
		steps: e.steps.map((e) => ({
			...e,
			animations: e.animations.filter((e) => t.has(e.from) && t.has(e.to)),
			statics: e.statics.filter((e) => t.has(e.from) && t.has(e.to))
		}))
	}), y = K(), b = K(), x = Infinity, S = -Infinity, C = -Infinity, w = (e) => {
		x = Math.min(x, e.x), S = Math.max(S, e.x + e.width), C = Math.max(C, e.y + e.height);
	};
	if (p) {
		let n = new Set(p), a = /* @__PURE__ */ new Set();
		for (let t of e.nodes) n.has(i.get(t.id) ?? t.id) && a.add(t.id);
		let o = v(a, h === void 0 && r !== void 0), s = Sr(o, t(o));
		for (let [e, t] of Object.entries(s.nodes)) y[e] = t, w(t);
		for (let [e, t] of Object.entries(s.groups)) b[e] = t, w(t);
	}
	let T = Xt(e);
	for (let e of g) {
		let t = v(new Set(e), !1), n = Sr(t, jr(t)), r = Object.entries(n.nodes);
		if (r.length === 0) continue;
		let i = Math.min(...r.map(([, e]) => e.x)), a = Math.min(...r.map(([e, t]) => t.y - (T.get(e) ?? 0))), o = Number.isFinite(x) ? x : G.x, s = Number.isFinite(C) ? C + kr : G.y, c = o - i, l = s - a;
		for (let [e, t] of r) {
			let n = {
				...t,
				x: t.x + c,
				y: t.y + l
			};
			y[e] = n, w(n);
		}
	}
	if (h !== void 0) {
		let n = /* @__PURE__ */ new Set();
		for (let t of e.nodes) i.get(t.id) === h && n.add(t.id);
		let r = v(n, !0), a = Sr(r, t(r)), o = Object.entries(a.nodes), s = Object.entries(a.groups);
		if (o.length > 0 || s.length > 0) {
			let e = Math.min(...o.map(([, e]) => e.x), ...s.map(([, e]) => e.x)), t = Math.min(...o.map(([e, t]) => t.y - (T.get(e) ?? 0)), ...s.map(([, e]) => e.y)), n = Number.isFinite(x) ? x : G.x, r = Number.isFinite(C) ? C + kr : G.y, i = n - e, a = r - t;
			for (let [e, t] of o) {
				let n = {
					...t,
					x: t.x + i,
					y: t.y + a
				};
				y[e] = n, w(n);
			}
			for (let [e, t] of s) {
				let n = {
					...t,
					x: t.x + i,
					y: t.y + a
				};
				b[e] = n, w(n);
			}
		}
	}
	if (_.length > 0) {
		let e = _.map((e) => {
			let t = T.get(e) ?? 0;
			return {
				id: e,
				width: W.width,
				height: W.height,
				head: 0,
				contentHeight: W.height,
				loopRoom: t,
				nodeLoopRoom: t > 0 ? /* @__PURE__ */ new Map([[e, t]]) : /* @__PURE__ */ new Map(),
				flippable: !1,
				nodes: /* @__PURE__ */ new Map([[e, {
					x: 0,
					y: 0,
					width: W.width,
					height: W.height
				}]]),
				groups: /* @__PURE__ */ new Map(),
				groupsFlipped: /* @__PURE__ */ new Map(),
				reflectConst: /* @__PURE__ */ new Map()
			};
		});
		if (Number.isFinite(x)) {
			let t = {
				block: {
					id: "__connected__",
					width: S - x,
					height: 0,
					head: 0,
					contentHeight: 0,
					loopRoom: 0,
					nodeLoopRoom: /* @__PURE__ */ new Map(),
					flippable: !1,
					nodes: /* @__PURE__ */ new Map(),
					groups: /* @__PURE__ */ new Map(),
					groupsFlipped: /* @__PURE__ */ new Map(),
					reflectConst: /* @__PURE__ */ new Map()
				},
				x,
				y: C,
				flip: 0
			};
			for (let n of $n(e, [t])) y[n.block.id] = {
				x: Math.round(n.x),
				y: Math.round(n.y),
				...W
			};
		} else for (let t of $n(e, [])) y[t.block.id] = {
			x: Math.round(t.x + G.x),
			y: Math.round(t.y + G.y),
			...W
		};
	}
	return {
		nodes: y,
		groups: b
	};
}
function jr(e, t, n = U(e), r = X(e, n)) {
	let i = Lt(e.groups), a = Lt(e.nodes), o = /* @__PURE__ */ new Map();
	for (let t of e.groups) t.parentId && b(o, t.parentId, t.id);
	let s = /* @__PURE__ */ new Map();
	for (let t of e.nodes) t.parentId && b(s, t.parentId, t.id);
	let c = Rr(e, i), l = Math.max(0, ...Xt(e).values()), u = new Map(e.nodes.map((e) => [e.id, l])), d = An(e.nodes.map((e) => e.id), r.forwardEdges);
	if (!t && r.hasAnimate && e.groups.length > 0) {
		let t = new Set(r.forwardEdges.map(([, e]) => e)), n = /* @__PURE__ */ new Set();
		for (let e of r.connections) e.role !== "static" && (n.add(e.from), n.add(e.to));
		for (let i of e.nodes) {
			if (i.parentId === void 0 || t.has(i.id) || n.has(i.id)) continue;
			let e = Infinity;
			for (let [t, n] of r.forwardEdges) if (t === i.id) {
				let t = d.rank.get(n);
				t !== void 0 && t < e && (e = t);
			}
			Number.isFinite(e) && e >= 2 && d.rank.set(i.id, e - 1);
		}
	}
	if (t) for (let [e, n] of t) d.rank.has(e) && d.rank.set(e, n);
	let f = Mr(e, d.rank, c, o, s), p = e.nodes.length > 0 || c.size > 0 ? Fr(e, n, c, d, f, i, a) : void 0, m = Nr(n, d.rank, (e) => {
		let t = K(), n = K();
		return p && Lr(p, d, t, n, u, e), {
			nodes: t,
			placeholders: n
		};
	});
	return {
		nodes: m.nodes,
		groups: zr(e, m.nodes, m.placeholders, u, f, o, s)
	};
}
function Mr(e, t, n, r, i) {
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
	for (let c of [...e.groups].reverse()) {
		let e = (r.get(c.id) ?? []).flatMap((e) => a.get(e) ?? []), l = [
			...(i.get(c.id) ?? []).map((e) => t.get(e) ?? 0),
			...n.has(c.id) ? [0] : [],
			...e.flatMap((e) => [e.min, e.max])
		];
		if (l.length === 0) continue;
		let u = Math.min(...l), d = Math.max(...l);
		a.set(c.id, {
			min: u,
			max: d,
			left: 1 + Math.max(0, ...e.filter((e) => e.min === u).map((e) => e.left)),
			right: 1 + Math.max(0, ...e.filter((e) => e.max === d).map((e) => e.right))
		}), s.add(u), o.add(d);
	}
	let c = /* @__PURE__ */ new Map();
	for (let t of e.groups) {
		let e = a.get(t.id);
		if (!e) continue;
		let n = t.parentId === void 0 ? void 0 : a.get(t.parentId), r = t.parentId === void 0 ? void 0 : c.get(t.parentId);
		c.set(t.id, {
			left: n?.min === e.min && r ? r.left : 16 / e.left,
			right: n?.max === e.max && r ? r.right : 16 / e.right
		});
	}
	return {
		endsAt: o,
		startsAt: s,
		pads: c
	};
}
function Nr(e, t, n) {
	let r = e.filter((e) => e.from !== e.to && t.has(e.from) && t.has(e.to)).map((e) => [e.from, e.to]), i = n();
	if (r.length === 0 || r.length > Or) return i;
	let a = (e) => {
		let n = /* @__PURE__ */ new Map(), i = (r, i) => {
			e(t.get(r) ?? 0, t.get(i) ?? 0) && b(n, r, i);
		};
		for (let [e, t] of r) i(e, t), i(t, e);
		return n;
	}, o = a((e, t) => t < e), s = a((e, t) => t > e), c = a(() => !0), l = i, u = Pr(r, l), d = 0;
	for (let e = 0; e < Er && d < Dr; e++) {
		i = n({
			previous: i,
			columnNeighbors: e % 2 == 0 ? o : s,
			linked: c
		});
		let t = Pr(r, i);
		t.crossings < u.crossings || t.crossings === u.crossings && t.length < u.length ? (l = i, u = t, d = 0) : d++;
	}
	return l;
}
function Pr(e, t) {
	let n = Cn(e, t);
	return {
		crossings: Dn(n),
		length: n.reduce((e, t) => e + Math.abs(t.ay - t.by), 0)
	};
}
function Fr(e, t, r, i, a, o, s) {
	let c = (e) => ({
		id: e,
		nodes: [],
		children: [],
		allNodes: [],
		colSpan: [0, 0],
		needsLayout: !1
	}), l = /* @__PURE__ */ new Map(), u = c(void 0);
	l.set(void 0, u);
	for (let t of e.groups) l.set(t.id, c(t.id));
	for (let t of e.groups) {
		let e = l.get(t.id);
		e && l.get(t.parentId)?.children.push(e);
	}
	for (let t of e.nodes) l.get(s.get(t.id))?.nodes.push(t.id);
	let f = (e) => i.rank.get(e) ?? 0, p = (e) => {
		let t = e.nodes.map(f);
		e.id !== void 0 && r.has(e.id) && t.push(0);
		let n = [...e.nodes], i = !1;
		for (let r of e.children) t.push(...p(r)), n.push(...r.allNodes), r.needsLayout && (i = !0);
		return e.allNodes = n, e.colSpan = t.length === 0 ? [0, 0] : [Math.min(...t), Math.max(...t)], e.needsLayout = e.nodes.length > 0 || e.id !== void 0 && r.has(e.id) || i, t;
	};
	p(u);
	let m = Math.max(0, ...e.nodes.map((e) => f(e.id))), h = Math.max(0, ...e.groups.map((e) => Bt(o, e.id).length)) * 16, g = (e) => (a.endsAt.has(e) ? 16 : 0) + (a.startsAt.has(e + 1) ? 16 : 0), _ = /* @__PURE__ */ new Map();
	for (let e of t) e.from !== e.to && i.rank.has(e.from) && i.rank.has(e.to) && (_.set(e.from, (_.get(e.from) ?? 0) + 1), _.set(e.to, (_.get(e.to) ?? 0) + 1));
	let v = new Int32Array(m), y = new Int32Array(m);
	for (let e of t) {
		if (e.from === e.to || !i.rank.has(e.from) || !i.rank.has(e.to)) continue;
		let t = f(e.from), n = f(e.to), r = Math.min(t, n), a = Math.max(t, n), o = a - r >= 2 || (_.get(e.from) ?? 0) >= 4 || (_.get(e.to) ?? 0) >= 4;
		for (let e = r; e < a; e++) y[e] = (y[e] ?? 0) + 1, o && (v[e] = (v[e] ?? 0) + 1);
	}
	let b = /* @__PURE__ */ new Map();
	for (let t of e.steps) for (let e of t.statics) {
		if (!e.label || e.from === e.to || !i.rank.has(e.from) || !i.rank.has(e.to)) continue;
		let t = f(e.from), r = f(e.to);
		if (Math.abs(t - r) !== 1) continue;
		let a = Math.min(188, d(e.label, n)), o = Math.ceil(a + 32 - (W.width - 44)), s = Math.min(t, r);
		o > (b.get(s) ?? 0) && b.set(s, o);
	}
	let x = [], S = G.x + h;
	for (let e = 0; e <= m; e++) {
		x.push(S);
		let t = Math.max(v[e] ?? 0, (y[e] ?? 0) >= 4 ? y[e] ?? 0 : 0), n = Math.max(Cr + Math.min(112, Math.max(0, t - 2) * 14), b.get(e) ?? 0);
		S += W.width + n + g(e);
	}
	let C = 0;
	for (let e of t) e.from !== e.to && i.rank.has(e.from) && i.rank.has(e.to) && Math.abs(f(e.from) - f(e.to)) >= 2 && C++;
	let w = 0;
	for (let e of _.values()) e >= 5 && w++;
	return {
		root: u,
		columnX: x,
		maxRank: m,
		inset: h,
		rowGap: wr + Math.min(20, Math.floor((C + w * 2) / 3) * 4)
	};
}
var Ir = 34;
function Lr(e, t, n, r, i, a) {
	let o = (e) => t.rank.get(e) ?? 0, s = (e) => a?.previous.nodes[e]?.y ?? 0, c = (e) => e.length > 0 ? e.reduce((e, t) => e + s(t), 0) / e.length : void 0, l = (e) => {
		let t = new Set(e), n = e.flatMap((e) => (a?.linked.get(e) ?? []).filter((e) => !t.has(e)));
		return c(n) ?? c(e) ?? Infinity;
	}, u = (e) => {
		if (a) return c(a.columnNeighbors.get(e) ?? []) ?? s(e);
		let r = (t.predecessors.get(e) ?? []).filter((e) => n[e]);
		return r.length > 0 ? r.reduce((e, t) => e + (n[t]?.y ?? 0), 0) / r.length : Infinity;
	}, d = Math.max(0, ...i.values()), f = Ir + d, p = (e) => Math.max(0, ...e.children.filter((e) => e.needsLayout).map((e) => 1 + p(e))), m = (t, i) => {
		let c = t.id !== void 0, h = p(t), g = i + (c ? 34 : 0) + d, _ = Array.from({ length: e.maxRank + 1 }, () => g), v = g, y = /* @__PURE__ */ new Map();
		for (let e of t.nodes) b(y, o(e), e);
		let x = [], S = 0;
		for (let [e, t] of y.entries()) x.push({
			kind: "col",
			rank: e,
			ids: t,
			minCol: e,
			maxCol: e,
			order: S++
		});
		for (let e of t.children) {
			if (!e.needsLayout) continue;
			let [t, n] = e.colSpan;
			x.push({
				kind: "group",
				child: e,
				minCol: t,
				maxCol: n,
				order: S++
			});
		}
		if (a) {
			let e = new Map(x.map((e) => [e, l(e.kind === "col" ? e.ids : e.child.allNodes)]));
			x.sort((t, n) => (e.get(t) ?? 0) - (e.get(n) ?? 0) || t.order - n.order);
		} else x.sort((e, t) => e.minCol - t.minCol || e.order - t.order);
		for (let t of x) if (t.kind === "col") {
			let { rank: r, ids: i } = t, a = i.map((e, t) => ({
				id: e,
				key: u(e),
				i: t
			}));
			a.sort((e, t) => e.key - t.key || s(e.id) - s(t.id) || e.i - t.i);
			let o = _[r] ?? g;
			o === g && (o += h * f);
			for (let { id: t } of a) n[t] = {
				x: e.columnX[r] ?? G.x,
				y: o,
				...W
			}, o += W.height + e.rowGap + d;
			let c = o - e.rowGap - d;
			_[r] = c + Tr, v = Math.max(v, c);
		} else {
			let { child: e, minCol: n, maxCol: r } = t, i = Math.max(..._.slice(n, r + 1)), a = i === g ? i + (h - 1 - p(e)) * f : i, o = m(e, a);
			for (let e = n; e <= r; e++) _[e] = o + Tr + d;
			v = Math.max(v, o);
		}
		return c && v === g && t.id !== void 0 && (r[t.id] = {
			x: e.columnX[0] ?? G.x,
			y: g,
			...Gt
		}, v = g + Gt.height), v + (c ? 16 : 0);
	};
	m(e.root, G.y + e.inset);
}
function Rr(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of e.nodes) for (let e of Bt(t, r.parentId)) n.add(e);
	return new Set(e.groups.filter((e) => !n.has(e.id)).map((e) => e.id));
}
function zr(e, t, n, r, i, a, o) {
	let s = K(), c = new Set(e.groups.map((e) => e.id)), l = (e) => {
		if (!c.has(e)) return;
		let u = n[e], d = [
			...u ? [u] : [],
			...(o.get(e) ?? []).flatMap((e) => {
				let n = t[e];
				if (!n) return [];
				let i = r.get(e) ?? 0;
				return [{
					...n,
					y: n.y - i,
					height: n.height + i
				}];
			}),
			...(a.get(e) ?? []).flatMap((e) => {
				let t = s[e] ?? l(e);
				return t ? [t] : [];
			})
		], f;
		if (d.length === 0) f = {
			...G,
			width: 240,
			height: 140
		};
		else {
			let t = Zt(d), n = i.pads.get(e), r = t.x - (n?.left ?? 16), a = t.y - 16 - 18, o = t.x + t.width + (n?.right ?? 16), s = t.y + t.height + 16;
			f = {
				x: r,
				y: a,
				width: o - r,
				height: s - a
			};
		}
		return s[e] = f, f;
	};
	for (let t of e.groups) s[t.id] || l(t.id);
	return s;
}
// src/layout/zoneScore.ts
var Br = 1.6, Vr = 160, Hr = 2, Ur = 1, Wr = 2, Gr = 250, Kr = 130, qr = 2400, Jr = 1200, Yr = 6.2, Xr = 12;
function Q(e, t, n) {
	if (!e?.wrapped || !e.rowOfBlock) return !1;
	let r = e.rowOfBlock.get(t), i = e.rowOfBlock.get(n);
	return r !== void 0 && i !== void 0 && r !== i;
}
function Zr(e, t, n, r = !1, i, a = 60) {
	let o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Set(), l = [], u = /* @__PURE__ */ new Set();
	for (let n of e.connections) {
		let r = t.get(n.from) ?? n.from, i = t.get(n.to) ?? n.to;
		if (r !== i) {
			if (o.has(r) || o.set(r, /* @__PURE__ */ new Set()), o.has(i) || o.set(i, /* @__PURE__ */ new Set()), o.get(r)?.add(i), o.get(i)?.add(r), n.role === "return") c.add(`${r}\0${i}`);
			else if (n.role === "primary" && !(e.auxiliaryZones.has(r) || e.auxiliaryZones.has(i)) && (s.has(r) || s.set(r, /* @__PURE__ */ new Set()), s.get(r)?.add(i), (e.zoneStage.get(r) ?? 0) < (e.zoneStage.get(i) ?? 0))) {
				let e = `${r}\0${i}`;
				u.has(e) || (u.add(e), l.push([r, i]));
			}
		}
	}
	for (let t of e.primaryZonePairs) {
		let n = t.indexOf("\0");
		if (n < 0) continue;
		let r = t.slice(0, n), i = t.slice(n + 1);
		if (!(e.auxiliaryZones.has(r) || e.auxiliaryZones.has(i)) && (e.zoneStage.get(r) ?? 0) < (e.zoneStage.get(i) ?? 0)) {
			let e = `${r}\0${i}`;
			u.has(e) || (u.add(e), l.push([r, i]));
		}
	}
	let d = [], f = [];
	for (let e of l) {
		let [t, n] = e;
		(o.get(n)?.size ?? 0) === 1 && c.has(`${n}\0${t}`) && (s.get(n)?.size ?? 0) === 0 && (s.get(t)?.size ?? 0) > 1 ? f.push(e) : d.push(e);
	}
	let p = gn(e, t), m = [.../* @__PURE__ */ new Set([...e.zoneStage.keys(), ...t.values()])], h = new Map(m.map((e, t) => [e, t])), g = (e) => e.flatMap(([e, t]) => {
		let n = h.get(e), r = h.get(t);
		return n !== void 0 && r !== void 0 ? [[n, r]] : [];
	}), _ = p.flatMap(({ a: e, b: t, allowed: n }) => {
		let r = h.get(e), i = h.get(t);
		if (r === void 0 || i === void 0) return [];
		let a = new Uint8Array(m.length);
		for (let e of n) {
			let t = h.get(e);
			t !== void 0 && (a[t] = 1);
		}
		return [{
			a: r,
			b: i,
			allowed: n,
			allowedSlots: a
		}];
	});
	return {
		preserveFlow: n,
		wrapped: r,
		horizontalClearance: a,
		...i ? { rowOfBlock: i } : {},
		zoneStage: e.zoneStage,
		auxiliaryZones: e.auxiliaryZones,
		stagePairs: d,
		pendantPairs: f,
		corridors: p,
		slotOf: h,
		slots: Array(m.length),
		placedSlots: new Int32Array(Math.max(16, m.length)),
		stagePairIdx: g(d),
		pendantPairIdx: g(f),
		corridorIdx: _
	};
}
function Qr(e, t, n, r, i, a, o, s) {
	let c = n - e, l = r - t, u = 0, d = 1, f = (e, t) => {
		if (e === 0) return t > 0;
		let n = t / e;
		if (e < 0) {
			if (n > d) return !1;
			n > u && (u = n);
		} else {
			if (n < u) return !1;
			n < d && (d = n);
		}
		return !0;
	};
	return f(-c, e - i) && f(c, a - e) && f(-l, t - o) && f(l, s - t) && u + 1e-12 < d;
}
function $r(e, t) {
	let n = t.x + t.block.width, r = t.y + t.block.height;
	return e.maxX <= t.x || e.minX >= n || e.maxY <= t.y || e.minY >= r ? !1 : Qr(e.ax, e.ay, e.bx, e.by, t.x, n, t.y, r);
}
function ei(e) {
	e.ax = e.source.x + e.sourceX, e.ay = e.source.y + e.sourceY[e.source.flip], e.bx = e.target.x + e.targetX, e.by = e.target.y + e.targetY[e.target.flip], e.minX = Math.min(e.ax, e.bx), e.maxX = Math.max(e.ax, e.bx), e.minY = Math.min(e.ay, e.by), e.maxY = Math.max(e.ay, e.by);
}
function $(e) {
	for (let t of e) ei(t);
}
function ti(e) {
	let t = e.open[e.source.flip * 2 + e.target.flip], n = e.bx - e.ax, r = e.by - e.ay, i = Vr;
	return (t & 1 && n > 0 || t & 2 && n < 0) && (i = Math.min(i, Math.abs(r))), (t & 4 && r > 0 || t & 8 && r < 0) && (i = Math.min(i, Math.abs(n))), i;
}
var ni = (e, t) => t ? e.role === "primary" ? 1.2 : e.role === "return" ? .7 : .5 : e.role === "primary" ? 1 : e.role === "return" ? .85 : .7, ri = (e, t) => t ? e.role === "primary" ? 1.2 : e.role === "return" ? .75 : .6 : e.role === "primary" ? 1 : e.role === "return" ? .8 : .75;
function ii(e, t, n) {
	let r = e.bx - e.ax, i = Math.hypot(r, e.by - e.ay);
	if (e.role === "return") return ti(e) * .6 + i * .15;
	if (e.role === "static") {
		let t = e.auxTouch ? .35 : .05, n = e.auxTouch ? 1 : .3;
		return ti(e) * n + i * t;
	}
	let a = Q(n, e.source.block.id, e.target.block.id) ? 0 : t ? r <= 0 ? 2200 + -r * 4 : r < 40 ? (40 - r) * 10 : 0 : r < -30 ? 450 + -r * .45 : r < 0 ? 120 : 0;
	return ti(e) * (t ? 2.5 : Hr) + i + Math.max(0, i - 700) + a;
}
function ai(e) {
	if (e.role === "return" || e.role === "static" && !e.auxTouch) return 0;
	let t = Math.max(0, Math.abs(e.by - e.ay) - Math.max(0, e.bx - e.ax));
	return e.role === "static" ? t * .25 : t;
}
function oi(e, t, n) {
	return e.maxX < t.minX || t.maxX < e.minX || e.maxY < t.minY || t.maxY < e.minY ? 0 : e.fromIdx !== t.fromIdx && e.fromIdx !== t.toIdx && e.toIdx !== t.fromIdx && e.toIdx !== t.toIdx && En(e, t) ? Gr * Math.min(ni(e, n), ni(t, n)) : 0;
}
var si = 260, ci = 12, li = 160, ui = 95;
function di(e, t) {
	let n = t.x, r = n + t.block.width, i = t.y, a = i + t.block.height;
	if (e.maxX <= n || e.minX >= r || e.maxY <= i || e.minY >= a) return 0;
	let o = e.ay > i && e.ay < a, s = e.by > i && e.by < a, c = e.ax > n && e.ax < r, l = e.bx > n && e.bx < r, u = o || l, d = c || s;
	if (u && d) {
		let t = o && s ? 2 * Math.min(Math.min(e.ay, e.by) - i + ci, a + ci - Math.max(e.ay, e.by)) : 2 * Math.min(Math.min(e.ax, e.bx) - n + ci, r + ci - Math.max(e.ax, e.bx));
		return si + Math.max(0, t);
	}
	return u || d ? Qr(e.ax, e.ay, e.bx, e.by, n, r, i, a) ? li : ui : Qr(e.ax, e.ay, e.bx, e.by, n, r, i, a) ? Kr : 0;
}
function fi(e, t, n) {
	let r = 0, i = ri(e, n);
	for (let n of t) n !== e.source && n !== e.target && (r += di(e, n) * i);
	return r;
}
function pi(e, t, n) {
	let r = 0, i = 3.5;
	for (let a of e) if (!Q(n, a.source.block.id, a.target.block.id)) for (let e of t) {
		if (e === a.source || e === a.target || n?.wrapped && n.rowOfBlock && Q(n, a.source.block.id, e.block.id) && Q(n, a.target.block.id, e.block.id)) continue;
		let t = e.x - i, o = e.x + e.block.width + i, s = e.y - i, c = e.y + e.block.height + i;
		if (a.maxX <= t || a.minX >= o || a.maxY <= s || a.minY >= c) continue;
		let l = a.ay > s && a.ay < c || a.bx > t && a.bx < o, u = a.ax > t && a.ax < o || a.by > s && a.by < c;
		l && u && r++;
	}
	return r;
}
function mi(e, t) {
	let n = 0;
	for (let r of e) {
		if (r.role !== "primary" || Q(t, r.source.block.id, r.target.block.id)) continue;
		let e = r.bx - r.ax, i = r.by - r.ay, a = r.open[r.source.flip * 2 + r.target.flip] ?? 0, o = e > 16 && !!(a & 1) || e < -16 && !!(a & 2), s = i > 36 && !!(a & 4) || i < -36 && !!(a & 8);
		!o && !s && n++;
	}
	return n;
}
function hi(e, t) {
	let n = 0, r = 0;
	for (let i of e) {
		if (Q(t, i.source.block.id, i.target.block.id)) continue;
		n++;
		let e = i.bx - i.ax;
		e > 0 && e >= Math.abs(i.by - i.ay) && r++;
	}
	return n === 0 ? 1 : r / n;
}
function gi(e, t, n = !1) {
	let r = 0, i = 0, a = 0, o = (e, n, r, i, a) => {
		for (let o of t) if (o !== e.source && o !== e.target && o.x < r && o.x + o.block.width > n && o.y < a && o.y + o.block.height > i) return !1;
		return !0;
	}, s = [];
	for (let t of e) {
		let e = t.sourceFree[t.source.flip] ?? 0, c = t.targetFree[t.target.flip] ?? 0, l = t.source.x, u = l + t.source.block.width, d = t.source.y, f = d + t.source.block.height, p = t.target.x, m = p + t.target.block.width, h = t.target.y, g = h + t.target.block.height, _ = Math.min(t.ax, t.bx), v = Math.max(t.ax, t.bx), y = Math.min(t.ay, t.by), b = Math.max(t.ay, t.by), x = u <= p && !!(e & 1) && !!(c & 2) && o(t, u, p, y - 2, b + 2), S = m <= l && !!(e & 2) && !!(c & 1) && o(t, m, l, y - 2, b + 2), C = f <= h && !!(e & 4) && !!(c & 8) && o(t, _ - 2, v + 2, f, h), w = g <= d && !!(e & 8) && !!(c & 4) && o(t, _ - 2, v + 2, g, d), T = (t.bx > u && !!(e & 1) || t.bx < l && !!(e & 2)) && (t.ay < h && !!(c & 8) || t.ay > g && !!(c & 4)) && o(t, _, v, t.ay - 2, t.ay + 2) && o(t, t.bx - 2, t.bx + 2, y, b), E = (t.by > f && !!(e & 4) || t.by < d && !!(e & 8)) && (t.ax < p && !!(c & 2) || t.ax > m && !!(c & 1)) && o(t, t.ax - 2, t.ax + 2, y, b) && o(t, _, v, t.by - 2, t.by + 2), D = n && !x && u <= p && (!!(e & 1) || !!(c & 2)) && o(t, u, p, y - 2, b + 2), O = n && !S && m <= l && (!!(e & 2) || !!(c & 1)) && o(t, m, l, y - 2, b + 2);
		if (x || S || D || O) {
			let e = Math.abs(t.by - t.ay);
			if (e >= .5 && e <= 120 && r++, x || S) {
				if (e < .5) s.push([[t.ax, t.ay], [t.bx, t.by]]);
				else {
					let e = x ? (u + p) / 2 : (m + l) / 2;
					s.push([
						[t.ax, t.ay],
						[e, t.ay],
						[e, t.by],
						[t.bx, t.by]
					]);
				}
				continue;
			}
		}
		if (C || w) {
			let e = Math.abs(t.bx - t.ax);
			if (e >= .5 && e <= 120 && r++, e < .5) s.push([[t.ax, t.ay], [t.bx, t.by]]);
			else {
				let e = C ? (f + h) / 2 : (g + d) / 2;
				s.push([
					[t.ax, t.ay],
					[t.ax, e],
					[t.bx, e],
					[t.bx, t.by]
				]);
			}
			continue;
		}
		if (T) {
			s.push([
				[t.ax, t.ay],
				[t.bx, t.ay],
				[t.bx, t.by]
			]);
			continue;
		}
		if (E) {
			s.push([
				[t.ax, t.ay],
				[t.ax, t.by],
				[t.bx, t.by]
			]);
			continue;
		}
		let k = !!(e & 8) && !!(c & 8) && !(d > h && t.ax >= p && t.ax <= m) && !(h > d && t.bx >= l && t.bx <= u) && o(t, _, v, Math.min(d, h) - 16, Math.max(d, h)), A = !!(e & 4) && !!(c & 4) && !(f < g && t.ax >= p && t.ax <= m) && !(g < f && t.bx >= l && t.bx <= u) && o(t, _, v, Math.min(f, g), Math.max(f, g) + 16), j = !!(e & 2) && !!(c & 2) && !(l > p && t.ay >= h && t.ay <= g) && !(p > l && t.by >= d && t.by <= f) && o(t, Math.min(l, p) - 16, Math.max(l, p), y, b), M = !!(e & 1) && !!(c & 1) && !(u < m && t.ay >= h && t.ay <= g) && !(m < u && t.by >= d && t.by <= f) && o(t, Math.min(u, m), Math.max(u, m) + 16, y, b);
		if (k || A) {
			let e = k ? Math.min(d, h) - 14 : Math.max(f, g) + 14;
			s.push([
				[t.ax, t.ay],
				[t.ax, e],
				[t.bx, e],
				[t.bx, t.by]
			]);
		} else if (j || M) {
			let e = j ? Math.min(l, p) - 14 : Math.max(u, m) + 14;
			s.push([
				[t.ax, t.ay],
				[e, t.ay],
				[e, t.by],
				[t.bx, t.by]
			]);
		} else {
			i++, t.role === "primary" && a++;
			let e = t.by < t.ay ? d - 14 : f + 14, n = t.ax < t.bx ? p - 14 : m + 14;
			s.push([
				[t.ax, t.ay],
				[t.ax, e],
				[n, e],
				[n, t.by],
				[t.bx, t.by]
			]);
		}
	}
	let c = 0, l = 0, u = (e, t, n, r) => ((t[0] - e[0]) * (n[1] - e[1]) - (t[1] - e[1]) * (n[0] - e[0])) * ((t[0] - e[0]) * (r[1] - e[1]) - (t[1] - e[1]) * (r[0] - e[0])) >= -1e-6 ? !1 : ((r[0] - n[0]) * (e[1] - n[1]) - (r[1] - n[1]) * (e[0] - n[0])) * ((r[0] - n[0]) * (t[1] - n[1]) - (r[1] - n[1]) * (t[0] - n[0])) < -1e-6;
	for (let t = 0; t < e.length; t++) {
		let n = e[t], r = s[t];
		if (n && r) for (let i = t + 1; i < e.length; i++) {
			let t = e[i], a = s[i];
			if (!t || !a) continue;
			let o = +(n.fromIdx === t.fromIdx) + +(n.fromIdx === t.toIdx) + +(n.toIdx === t.fromIdx) + +(n.toIdx === t.toIdx);
			if (o === 2 || o === 0 && (n.role !== "primary" || t.role !== "primary")) continue;
			let d = 0;
			for (let e = 0; e + 1 < r.length; e++) {
				let t = r[e], n = r[e + 1];
				if (t && n) for (let e = 0; e + 1 < a.length; e++) {
					let r = a[e], i = a[e + 1];
					r && i && u(t, n, r, i) && d++;
				}
			}
			if (d > 0) o === 1 ? c += d : l += d;
			else if (o === 1) {
				let e = n.fromIdx === t.fromIdx, r = e ? n.ax : n.bx, i = e ? n.ay : n.by, a = e ? n.bx : n.ax, o = e ? n.by : n.ay, s = e ? t.bx : t.ax, l = e ? t.by : t.ay, u = a - r, d = s - r, f = o - i, p = l - i;
				u * d > 0 && Math.abs(u) > 40 && Math.abs(d) > 40 && f * p > 0 && (Math.abs(u) + 40 < Math.abs(d) && Math.abs(f) > Math.abs(p) + 24 || Math.abs(d) + 40 < Math.abs(u) && Math.abs(p) > Math.abs(f) + 24) && c++;
			}
		}
	}
	return {
		jogs: r,
		portWindings: i,
		primaryPortWindings: a,
		sharedCrossings: c,
		orthoPrimaryCrossings: l
	};
}
function _i(e) {
	if (e.length === 0) return {
		width: 0,
		height: 0
	};
	let t = Infinity, n = -Infinity, r = Infinity, i = -Infinity;
	for (let a of e) t = Math.min(t, a.x), n = Math.max(n, a.x + a.block.width), r = Math.min(r, a.y), i = Math.max(i, a.y + a.block.height);
	return {
		width: n - t,
		height: i - r
	};
}
function vi(e, t) {
	let { width: n, height: r } = _i(e), i = (Wr - n / Math.max(1, r)) / 1, a = t ? .35 : 0, o = t ? Math.max(0, n - r * Yr) * 3.5 : 0;
	return {
		spread: Math.max(n, r * Br) * 1.2 + o,
		offFlowWeight: Ur * Math.min(1, Math.max(a, i))
	};
}
function yi(e, t) {
	if (!t?.preserveFlow) return 0;
	let { slots: n, slotOf: r, stagePairIdx: i, pendantPairIdx: a, corridorIdx: o } = t;
	n.fill(void 0), t.placedSlots.length < e.length && (t.placedSlots = new Int32Array(e.length));
	let { placedSlots: s } = t;
	for (let t = 0; t < e.length; t++) {
		let i = e[t];
		if (!i) {
			s[t] = -1;
			continue;
		}
		let a = r.get(i.block.id);
		a === void 0 ? s[t] = -1 : (n[a] = i, s[t] = a);
	}
	let c = 0;
	for (let e = 0; e < i.length; e++) {
		let r = i[e];
		if (!r) continue;
		let a = n[r[0]], o = n[r[1]];
		if (!a || !o || Q(t, a.block.id, o.block.id)) continue;
		let s = a.x + a.block.width + t.horizontalClearance - o.x;
		s > 0 && (c += qr + s * 3);
	}
	for (let e = 0; e < a.length; e++) {
		let r = a[e];
		if (!r) continue;
		let i = n[r[0]], o = n[r[1]];
		if (!i || !o || Q(t, i.block.id, o.block.id)) continue;
		let s = i.x - o.x;
		s > 0 && (c += qr + s * 3);
	}
	for (let r = 0; r < o.length; r++) {
		let i = o[r];
		if (!i) continue;
		let a = n[i.a], l = n[i.b];
		if (!a || !l || Q(t, a.block.id, l.block.id)) continue;
		let u = a.x + a.block.width / 2, d = l.x + l.block.width / 2, f = Math.min(u, d), p = Math.max(u, d), m = Math.min(a.y, l.y), h = Math.max(a.y + a.block.height, l.y + l.block.height);
		for (let n = 0; n < e.length; n++) {
			let r = e[n], o = s[n] ?? -1;
			if (!r || r === a || r === l || o >= 0 && i.allowedSlots[o] === 1 || Q(t, a.block.id, r.block.id) || Q(t, l.block.id, r.block.id)) continue;
			let u = r.x + r.block.width / 2;
			u > f && u < p && r.y < h && r.y + r.block.height > m && (c += Jr);
		}
	}
	return c;
}
function bi(e, t, n) {
	let r = n?.preserveFlow ?? !1, { spread: i, offFlowWeight: a } = vi(t, r), o = i + yi(t, n);
	for (let i = 0; i < e.length; i++) {
		let s = e[i];
		if (s) {
			ei(s), o += ii(s, r, n) + ai(s) * a + fi(s, t, r);
			for (let t = 0; t < i; t++) {
				let n = e[t];
				n && (o += oi(s, n, r));
			}
		}
	}
	return o;
}
var xi = (e, t, n) => e.source === t || e.target === t || e.source === n || e.target === n;
function Si(e, t, n, r, i, a) {
	let o = a?.preserveFlow ?? !1, { spread: s, offFlowWeight: c } = vi(t, o), l = s + yi(t, a);
	for (let t = 0; t < e.length; t++) {
		let a = e[t];
		if (a) {
			if (xi(a, n, r)) i && ei(a);
			else {
				let e = ri(a, o);
				l += di(a, n) * e, r && (l += di(a, r) * e);
			}
			l += ai(a) * c;
		}
	}
	for (let i = 0; i < e.length; i++) {
		let s = e[i];
		if (s && xi(s, n, r)) {
			l += ii(s, o, a) + fi(s, t, o);
			for (let t = 0; t < e.length; t++) {
				let a = e[t];
				a && t !== i && (t > i || !xi(a, n, r)) && (l += oi(s, a, o));
			}
		}
	}
	return l;
}
function Ci(e, t, n = 60, r = 34) {
	for (let i of t) if (i !== e && e.x < i.x + i.block.width + n && i.x < e.x + e.block.width + n && e.y < i.y + i.block.height + r && i.y < e.y + e.block.height + r) return !1;
	return !0;
}
function wi(e, t, n) {
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		i && xi(i, t, n) && ei(i);
	}
}
function Ti(e, t, n, r, i, a, o, s = 0, c = 0, l = 0, u, d = 60, f = 34) {
	let p = n.x, m = n.y, h = n.flip, g = o ? o.x : 0, _ = o ? o.y : 0, v = o ? o.flip : 0;
	n.x = r, n.y = i, n.flip = a, o && (o.x = s, o.y = c, o.flip = l);
	let y = Ci(n, t, d, f) && (!o || Ci(o, t, d, f));
	if (n.x = p, n.y = m, n.flip = h, o && (o.x = g, o.y = _, o.flip = v), !y) return NaN;
	let b = Si(e, t, n, o, !1, u);
	return n.x = r, n.y = i, n.flip = a, o && (o.x = s, o.y = c, o.flip = l), Si(e, t, n, o, !0, u) - b;
}
function Ei(e, t, n, r) {
	let i = e.nodes.get(t);
	if (!i) return !1;
	let a = (t, n) => r ? Z(e, n, t) : n.y, o = i.x + i.width / 2, s = a(t, i), c = s + 50;
	for (let [r, l] of e.nodes) {
		if (r === t) continue;
		let e = a(r, l), u = c > e && c < e + l.height, d = o > l.x && o < l.x + l.width;
		if (n === 0 && u && l.x > i.x || n === 1 && u && l.x < i.x || n === 2 && d && e > s || n === 3 && d && e < s) return !1;
	}
	return !0;
}
function Di(e, t, n) {
	let r = 0;
	for (let i of [
		0,
		1,
		2,
		3
	]) Ei(e, t, i, n) && (r |= 1 << i);
	return r;
}
function Oi(e, t, n, r) {
	let i = (i, a) => {
		let o = 0;
		for (let [s, c] of [
			[0, 1],
			[1, 0],
			[2, 3],
			[3, 2]
		]) Ei(e, t, s, i) && Ei(n, r, c, a) && (o |= 1 << s);
		return o;
	};
	return [
		i(0, 0),
		i(0, 1),
		i(1, 0),
		i(1, 1)
	];
}
function ki(e, t, n = X(e)) {
	let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = 0;
	for (let e of t) for (let [t, n] of e.block.nodes) r.set(t, {
		idx: a++,
		p: e,
		x: n.x + n.width / 2,
		y: [n.y + 50, Z(e.block, n, t) + 50]
	}), i.set(t, e.block.id);
	return n.connections.flatMap((e) => {
		let t = r.get(e.from), a = r.get(e.to);
		if (!t || !a || t.p === a.p) return [];
		let o = n.auxiliaryZones.has(t.p.block.id) || n.auxiliaryZones.has(a.p.block.id);
		return [{
			role: pn(e, n, i) ? "return" : e.role,
			auxTouch: o,
			source: t.p,
			target: a.p,
			sourceX: t.x,
			targetX: a.x,
			sourceY: t.y,
			targetY: a.y,
			from: e.from,
			to: e.to,
			fromIdx: t.idx,
			toIdx: a.idx,
			open: Oi(t.p.block, e.from, a.p.block, e.to),
			sourceFree: [Di(t.p.block, e.from, 0), Di(t.p.block, e.from, 1)],
			targetFree: [Di(a.p.block, e.to, 0), Di(a.p.block, e.to, 1)],
			ax: 0,
			ay: 0,
			bx: 0,
			by: 0,
			minX: 0,
			maxX: 0,
			minY: 0,
			maxY: 0
		}];
	});
}
function Ai(e, t) {
	if (Math.abs(e.ay - e.by) >= .5 && Math.abs(e.ax - e.bx) >= .5) return !1;
	for (let n of t) if (n !== e.source && n !== e.target) {
		if ($r(e, n)) return !1;
		let t = n.y - (n.block.groups.size === 0 ? n.block.loopRoom : 0), r = n.y + n.block.height;
		if (Math.abs(e.ay - e.by) < .5 && e.maxX > n.x - Xr && e.minX < n.x + n.block.width + Xr && e.ay > t - Xr && e.ay < r + Xr || Math.abs(e.ax - e.bx) < .5 && e.maxY > t - Xr && e.minY < r + Xr && e.ax > n.x - Xr && e.ax < n.x + n.block.width + Xr) return !1;
	} else for (let [t, r] of n.block.nodes) {
		if (t === e.from || t === e.to) continue;
		let i = n.block.nodeLoopRoom.get(t) ?? 0, a = n.x + r.x, o = n.y + (n.flip ? Z(n.block, r, t) : r.y) - i;
		if (e.maxX > a && e.minX < a + r.width && e.maxY > o && e.minY < o + r.height + i) return !1;
	}
	return !0;
}
function ji(e, t, n, r) {
	let i = 0;
	for (let a of e) (!n || a.source === n || a.target === n || r !== void 0 && (a.source === r || a.target === r)) && Ai(a, t) && i++;
	return i;
}
function Mi(e, t, n, r) {
	let i = On(e, t);
	return i === 0 ? 0 : r ? i * 180 + kn(n.connections, t) * 440 : i * 180;
}
function Ni(e, t) {
	let n = 0;
	for (let r of e) r.role === "primary" && (Q(t, r.source.block.id, r.target.block.id) || r.bx <= r.ax && n++);
	return n;
}
function Pi(e, t, n, r, i, a = {}) {
	$(n);
	let o = a.mode ?? "full", s = a.layout ?? mr(t);
	if (o === "flip") {
		let o = a.preserveFlowOverride ?? i.preserveFlow, c = bi(n, t, i) + Mi(e, s, r, o);
		if (a.entryMask) for (let e = 0; e < t.length; e++) a.entryMask[e] === 1 && t[e]?.flip === 1 && (c += 120);
		return c;
	}
	if (o === "intrusion") {
		let o = _i(t), c = o.width / Math.max(1, o.height), l = c < 1.35 ? (1.35 - c) * 1e4 : 0, u = a.intrusions ?? 0;
		return bi(n, t, i) + Mi(e, s, r, a.preserveFlowOverride ?? !0) + u * 4200 + l;
	}
	if (o === "staged") {
		let o = _i(t), c = o.width / Math.max(1, o.height), l = c < 1.2 ? (1.2 - c) * 35e3 : 0;
		return bi(n, t, i) + Mi(e, s, r, a.preserveFlowOverride ?? i.preserveFlow) + l - ji(n, t) * 120;
	}
	let c = Zt([...Object.values(s.nodes), ...Object.values(s.groups)]), l = c.width / Math.max(1, c.height), u = _i(t), d = u.width / Math.max(1, u.height), f = t.length, p = f >= 7 ? 1.28 : 1.08, m = i.preserveFlow && (d < p || l < 1.08) ? Math.max(p - d, 1.08 - l) * 35e3 : 0, h = a.columnsCount ?? 0, g = a.allFlippable ?? !1, _ = a.firstAuxIdx ?? -1, v = a.hasNestedGroups ?? !1, y = h >= 4 ? 2.28 : 2.05, b = h >= 4 ? 2.48 : 1.85, x = Math.max(1.5, l), S = i.preserveFlow && (g || _ < 0) ? _ >= 0 ? x < y ? (y - x) * 2e4 : 0 : x < b ? (b - x) * 18e3 : 0 : 0, C = 0;
	if (a.entryMask) for (let e = 0; e < t.length; e++) a.entryMask[e] === 1 && t[e]?.flip === 1 && (C += 120);
	let w = 0;
	if (i.preserveFlow && _ >= 0 && !v) {
		for (let e of n) if (!Q(i, e.source.block.id, e.target.block.id)) {
			if (e.role !== "return") {
				let t = Math.hypot(e.bx - e.ax, e.by - e.ay);
				t > 1900 && (w += (t - 1900) * 1.5);
			}
			if (e.role === "primary") for (let n of t) n !== e.source && n !== e.target && $r(e, n) && (w += 120);
		}
	}
	let T = i.preserveFlow ? hi(n, i) : 1, E = i.preserveFlow && f <= 6 && T < .5 ? (.5 - T) * 25e3 : 0, D = i.preserveFlow && f <= 6 && (v || _ >= 0) ? gi(n, t) : {
		jogs: 0,
		portWindings: 0,
		primaryPortWindings: 0,
		sharedCrossings: 0,
		orthoPrimaryCrossings: 0
	}, O = i.preserveFlow && _ >= 0 && f <= 6 ? kn(r.connections, s) * 350 : 0, k = v ? D.orthoPrimaryCrossings * 900 + D.sharedCrossings * 450 + D.jogs * 360 + D.primaryPortWindings * 260 : D.portWindings * 200, A = i.preserveFlow ? pi(n, t, i) * (v ? 2800 : 800) + w + O + (_ < 0 ? mi(n, i) * 430 : 0) + E + k : 0, j = 0;
	if (i.preserveFlow) {
		let e = new Map(t.map((e) => [e.block.id, e]));
		for (let [t, n] of i.stagePairs) {
			if (Q(i, t, n)) continue;
			let r = e.get(t), a = e.get(n);
			r && a && r.x + r.block.width + 60 > a.x && (j += 6e3);
		}
		if (f >= 7) {
			let e = new Map(t.map((e) => [e.block.id, {
				x: e.x,
				y: e.y,
				width: e.block.width,
				height: e.block.height
			}]));
			j += _n(i.corridors, e, i.wrapped ? i.rowOfBlock : void 0) * 4200 + kn(r.connections, s) * 420;
		}
	}
	let M = i.preserveFlow ? 0 : (() => {
		let e = t.reduce((e, t) => e + t.block.width * t.block.height, 0) / Math.max(1, u.width * u.height);
		return e < .54 ? (.54 - e) * 12e3 : 0;
	})();
	return bi(n, t, i) + Mi(e, s, r, i.preserveFlow) + C + A + M + j + m + S - ji(n, t) * 120;
}
function Fi(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = [], a = [], o = [], s = [];
	e.forEach((e, t) => {
		for (let [n, c] of e.block.nodes) r.set(n, i.length), i.push(t), a.push(c.x + c.width / 2), o.push(c.y + 50), s.push(Z(e.block, c, n) + 50);
	});
	let c = i.length, l = new Int32Array(i), u = new Float64Array(a), d = new Float64Array(o), f = new Float64Array(s), p = new Float64Array(e.length), m = new Float64Array(e.length), h = [], g = [], _ = [];
	for (let [e, i] of t) {
		let t = r.get(e), a = r.get(i);
		t !== void 0 && a !== void 0 && (h.push(t), g.push(a), _.push(+(n.byPair.get(q(e, i))?.role === "primary")));
	}
	let v = h.length, y = new Int32Array(h), b = new Int32Array(g), x = new Uint8Array(_), S = new Float64Array(v), C = new Float64Array(v), w = new Float64Array(v), T = new Float64Array(v), E = new Float64Array(v), D = new Float64Array(v), O = new Float64Array(v), k = new Float64Array(v), A = (e) => {
		let t = Infinity, n = Infinity;
		for (let r = 0; r < e.length; r++) {
			let i = e[r];
			i && (i.x < t && (t = i.x), i.y < n && (n = i.y));
		}
		for (let r = 0; r < e.length; r++) {
			let i = e[r];
			i && (p[r] = Math.round(i.x - t + G.x), m[r] = Math.round(i.y - n + G.y));
		}
		for (let t = 0; t < v; t++) {
			let n = y[t] ?? 0, r = b[t] ?? 0, i = l[n] ?? 0, a = l[r] ?? 0, o = e[i]?.flip === 1, s = e[a]?.flip === 1, c = (p[i] ?? 0) + (u[n] ?? 0), h = (m[i] ?? 0) + ((o ? f[n] : d[n]) ?? 0), g = (p[a] ?? 0) + (u[r] ?? 0), _ = (m[a] ?? 0) + ((s ? f[r] : d[r]) ?? 0);
			S[t] = c, C[t] = h, w[t] = g, T[t] = _, E[t] = Math.min(c, g), D[t] = Math.max(c, g), O[t] = Math.min(h, _), k[t] = Math.max(h, _);
		}
	}, j = (e, t) => {
		if ((D[e] ?? 0) <= (E[t] ?? 0) || (D[t] ?? 0) <= (E[e] ?? 0) || (k[e] ?? 0) <= (O[t] ?? 0) || (k[t] ?? 0) <= (O[e] ?? 0)) return !1;
		let n = S[e] ?? 0, r = C[e] ?? 0, i = (w[e] ?? 0) - n, a = (T[e] ?? 0) - r, o = S[t] ?? 0, s = C[t] ?? 0, c = w[t] ?? 0, l = T[t] ?? 0, u = i * (s - r) - a * (o - n), d = i * (l - r) - a * (c - n);
		if (Math.sign(u) * Math.sign(d) >= 0) return !1;
		let f = c - o, p = l - s, m = f * (r - s) - p * (n - o), h = f * ((T[e] ?? 0) - s) - p * ((w[e] ?? 0) - o);
		return Math.sign(m) * Math.sign(h) < 0;
	};
	A(e);
	let M = new Uint8Array(e.length);
	for (let t = 0; t < e.length; t++) (e[t]?.block.groups.size ?? 0) > 1 && (M[t] = 1);
	let N = 0, P = 0, F = [], ee = [], I = [];
	if (c >= 4) for (let e = 0; e < v; e++) {
		let t = y[e] ?? 0, n = b[e] ?? 0, r = l[t] ?? 0, i = r === (l[n] ?? 0), a = x[e] === 1;
		for (let o = e + 1; o < v; o++) {
			let s = y[o] ?? 0, c = b[o] ?? 0;
			if (t === s || t === c || n === s || n === c) continue;
			let u = a && x[o] === 1;
			i && M[r] === 0 && r === (l[s] ?? 0) && r === (l[c] ?? 0) ? j(e, o) && (N++, u && P++) : (F.push(e), ee.push(o), I.push(+!!u));
		}
	}
	let te = new Int32Array(F), ne = new Int32Array(ee), re = new Uint8Array(I), L = te.length, ie = /* @__PURE__ */ new Map();
	for (let t of e) ie.set(t.block.id, {
		x: t.x,
		y: t.y,
		width: t.block.width,
		height: t.block.height
	});
	return {
		segCount: v,
		totalNodes: c,
		syncAndCountCrossings(e) {
			A(e);
			let t = N, n = P;
			for (let e = 0; e < L; e++) j(te[e] ?? 0, ne[e] ?? 0) && (t++, re[e] === 1 && n++);
			return {
				totalCross: t,
				priCross: n
			};
		},
		countIntrusions(e, t, n) {
			for (let t of e) {
				let e = ie.get(t.block.id);
				e && (e.x = t.x, e.y = t.y);
			}
			return _n(t, ie, n);
		}
	};
}
function Ii(e, t, n, r, i) {
	let { totalCross: a, priCross: o } = e.syncAndCountCrossings(t), s = e.countIntrusions(t, r.corridors, r.wrapped ? r.rowOfBlock : void 0), c = _i(t), l = c.width / Math.max(1, c.height), u = l < 1.28 ? (1.28 - l) * 35e3 : 0;
	return bi(n, t, r) * .45 + a * 420 + s * 4200 + o * 700 + i * 8e3 + u;
}
// src/layout/zoneFinish.ts
var Li = [
	128,
	64,
	32,
	16,
	8,
	4
], Ri = 4, zi = 8, Bi = 140, Vi = 30, Hi = 98, Ui = 120;
function Wi(e, t, n = 34) {
	return e === "x" ? {
		across: "y",
		size: "width",
		acrossSize: "height",
		clearance: t,
		acrossClearance: n
	} : {
		across: "x",
		size: "height",
		acrossSize: "width",
		clearance: n,
		acrossClearance: t
	};
}
function Gi(e, t) {
	return [
		{
			x: e.x,
			y: t.y
		},
		{
			x: e.x,
			y: t.y + t.block.height - e.block.height
		},
		{
			x: e.x,
			y: t.y + (t.block.height - e.block.height) / 2
		},
		{
			x: t.x,
			y: e.y
		}
	];
}
function Ki(e, t, n, r = 60, i = 34) {
	let a = bi(e, t, n), o = a, s = /* @__PURE__ */ new Set();
	for (let t of e) s.add(`${t.source.block.id}\0${t.target.block.id}`), s.add(`${t.target.block.id}\0${t.source.block.id}`);
	let c = (s, c, l) => {
		let u = s.x, d = s.y;
		if (c.x === u && c.y === d || Math.abs(c.x - u) > Bi || Math.abs(c.y - d) > Bi) return;
		let f = n?.preserveFlow ? pi(e, t, n) : 0, p = Ti(e, t, s, c.x, c.y, s.flip, void 0, 0, 0, 0, n, r, i);
		Number.isNaN(p) || ((!n?.preserveFlow || pi(e, t, n) <= f) && a + p <= o + l ? (a += p, o = Math.min(o, a)) : (s.x = u, s.y = d, wi(e, s, void 0)));
	};
	for (let e = 0; e < 3; e++) for (let e of t) for (let r of t) {
		if (e === r) continue;
		let t = !n?.preserveFlow || s.has(`${e.block.id}\0${r.block.id}`) ? Vi : 0;
		for (let n of Gi(e, r)) c(e, n, t);
	}
}
function qi(e, t, n, r = 60, i = 34) {
	$(e);
	let a = (e, t) => e.role === "primary" ? 1 : e.role === "return" ? .08 : e.auxTouch && n?.auxiliaryZones.has(t) ? .8 : .05;
	for (let o = 0; o < 10; o++) {
		let o = !1;
		for (let s of t) {
			let c = 0, l = 0, u = 0;
			for (let t of e) {
				let e = a(t, s.block.id);
				t.source === s ? (c += (t.bx - t.sourceX) * e, l += (t.by - t.sourceY[s.flip]) * e, u += e) : t.target === s && (c += (t.ax - t.targetX) * e, l += (t.ay - t.targetY[s.flip]) * e, u += e);
			}
			if (u === 0) continue;
			let d = {
				x: c / u,
				y: l / u
			};
			for (let a of ["x", "y"]) for (let c of Li) for (;;) {
				let l = d[a] - s[a];
				if (Math.abs(l) < c) break;
				let u = s[a], f = u + Math.sign(l) * c, p = Ti(e, t, s, a === "x" ? f : s.x, a === "y" ? f : s.y, s.flip, void 0, 0, 0, 0, n, r, i);
				if (Number.isNaN(p)) break;
				if (p < 0) o = !0;
				else {
					s[a] = u, wi(e, s, void 0);
					break;
				}
			}
		}
		if (!o) break;
	}
}
function Ji(e, t, n, r, i) {
	let { across: a, size: o, acrossSize: s, clearance: c, acrossClearance: l } = Wi(n, r, i);
	return e[a] >= t[a] + t.block[s] + l || t[a] >= e[a] + e.block[s] + l || e[n] + e.block[o] <= t[n] ? Infinity : e[n] - (t[n] + t.block[o]) - c;
}
function Yi(e, t, n, r, i, a, o, s, c) {
	let { across: l, acrossSize: u, acrossClearance: d } = Wi(i, s, c), f = r.map((e) => ({
		x: e.x,
		y: e.y
	})), p = (e, t) => {
		r.forEach((n, r) => {
			let a = f[r];
			n[i] = a[i] - e, n[l] = a[l] + t;
		});
	}, m = _i(t), h = () => {
		let { width: e, height: n } = _i(t);
		return e <= m.width && n <= m.height;
	}, g = {
		cost: bi(e, t, o),
		along: 0,
		step: 0
	}, _ = (a) => {
		if (p(0, a), a !== 0 && !r.every((e) => Ci(e, t, s, c))) return;
		let l = Infinity, u;
		for (let e of r) for (let t of n) {
			let n = Ji(e, t, i, s, c);
			n < l && (l = n, u = {
				stopped: e,
				stopper: t
			});
		}
		if (u) {
			for (let n = l; n >= zi; n /= 2) {
				if (p(n, a), a !== 0 && !h()) continue;
				let r = bi(e, t, o);
				if (r < g.cost) {
					g = {
						cost: r,
						along: n,
						step: a
					};
					break;
				}
			}
			return u;
		}
	}, v = _(0);
	if (v && a) {
		let { stopped: e, stopper: t } = v, n = f[r.indexOf(e)][l];
		_(t[l] + t.block[u] + d - n), _(t[l] - d - e.block[u] - n);
	}
	return p(g.along, g.step), g.along !== 0;
}
function Xi(e, t, n, r, i = 60, a = 34) {
	for (let o = 0; o < Ri; o++) {
		let o = !1;
		for (let s of ["x", "y"]) {
			let c = [...t].sort((e, t) => e[s] - t[s]);
			for (let l = 1; l < c.length; l++) Yi(e, t, c.slice(0, l), c.slice(l), s, n, r, i, a) && (o = !0);
		}
		if (!o) break;
	}
	$(e);
}
function Zi(e, t, n = Hi, r = !1) {
	if (e.length < 2) return;
	let i = t?.preserveFlow && t.auxiliaryZones.size > 0 ? e.filter((e) => !t.auxiliaryZones.has(e.block.id)) : e;
	if (i.length < 2) return;
	let a = [...i].sort((e, t) => e.x - t.x || e.y - t.y), o = -Infinity;
	for (let s = 1; s < a.length; s++) {
		let c = a[s - 1];
		c && (o = Math.max(o, c.x + c.block.width));
		let l = a[s];
		if (!l) continue;
		let u = l.x - o;
		if (u >= 59 && u < n) {
			let c = (o + l.x) / 2, d = n - u;
			for (let e = s; e < a.length; e++) {
				let t = a[e];
				t && (t.x += d);
			}
			if (i !== e) for (let n of e) t?.auxiliaryZones.has(n.block.id) && n.x + n.block.width / 2 >= c && (n.x += d);
			if (o += d, r) return;
		}
	}
}
function Qi(e, t) {
	if (e.role !== "primary" || e.ax >= e.bx || (e.targetFree[e.target.flip] ?? 0) & 4) return 0;
	let n = e.sourceY[e.source.flip];
	for (let r of t) if (r.role === "return" && r.from === e.to && r.target === e.source && r.targetY[e.source.flip] > n + 40) return 3;
	return 0;
}
function $i(e, t, n = 120, r, i = 60, a = 34) {
	$(e);
	for (let o = 0; o < 4; o++) {
		let o = !1;
		for (let s of t) {
			let c = s.x, l = s.y, u = ji(e, t, s), d = (t, n) => {
				let r = 0;
				for (let i of e) {
					let a = Qi(i, e);
					a > 0 && (i.source === t || i.target === t || n !== void 0 && (i.source === n || i.target === n)) && Math.abs(i.by - (i.ay + a)) < .5 && r++;
				}
				return r;
			}, f = d(s), p = pi(e, t, r), m = [];
			for (let t of e) {
				if (t.source !== s && t.target !== s) continue;
				let n = t.source === s ? 1 : -1, r = (t.bx - t.ax) * n, i = Qi(t, e), a = (t.by - (t.ay + i)) * n;
				a !== 0 && Math.abs(a) <= Ui && m.push({
					x: c,
					y: l + a,
					primaryY: t.role === "primary"
				}), r !== 0 && Math.abs(r) <= Ui && m.push({
					x: c + r,
					y: l
				});
			}
			let h;
			for (let o of m) {
				let m = o.x - c, g = o.y - l, _ = Math.abs(m) + Math.abs(g), v = Ti(e, t, s, o.x, o.y, s.flip, void 0, 0, 0, 0, r, i, a);
				if (!Number.isNaN(v)) {
					let i = ji(e, t, s) - u, a = d(s) - f, m = Math.max(i, i >= 0 ? a : 0);
					m > 0 && v <= m * n && pi(e, t, r) <= p && (!h || m > h.gain || m === h.gain && _ < h.reach) && (h = {
						x: o.x,
						y: o.y,
						px: 0,
						py: 0,
						gain: m,
						reach: _
					}), s.x = c, s.y = l, wi(e, s, void 0);
				} else if (r?.preserveFlow && _ <= 36 && !r.auxiliaryZones.has(s.block.id)) {
					s.x = o.x, s.y = o.y;
					let u = t.filter((e) => e !== s && s.x < e.x + e.block.width + i && e.x < s.x + s.block.width + i && s.y < e.y + e.block.height + a && e.y < s.y + s.block.height + a);
					s.x = c, s.y = l;
					let f = u[0];
					if (u.length === 1 && f && (r.auxiliaryZones.has(f.block.id) || g > 0 && f.y >= l + s.block.height)) {
						let u = f.x, v = f.y, y = ji(e, t, s, f), b = d(s, f), x = Ti(e, t, s, o.x, o.y, s.flip, f, u + m, v + g, f.flip, r, i, a);
						if (!Number.isNaN(x)) {
							let i = ji(e, t, s, f) - y, a = d(s, f) - b, S = Math.max(i, i >= 0 ? a : 0);
							S > 0 && x <= S * n && pi(e, t, r) <= p && (!h || S > h.gain || S === h.gain && _ < h.reach) && (h = {
								x: o.x,
								y: o.y,
								partner: f,
								px: u + m,
								py: v + g,
								gain: S,
								reach: _
							}), s.x = c, s.y = l, f.x = u, f.y = v, wi(e, s, f);
						}
					}
				}
				if (r?.preserveFlow && o.primaryY && Math.abs(g) > 0 && Math.abs(g) <= 28 && m === 0) {
					let u = (t) => e.some((e) => (e.source === t || e.target === t) && Math.abs(e.ax - e.bx) < .5);
					if (!s.block.flippable || u(s)) continue;
					let d = /* @__PURE__ */ new Set();
					for (let t of e) t.role !== "primary" || Math.abs(t.ay - t.by) >= .5 || t.source === s && t.target.x > s.x && t.target.block.flippable && !r.auxiliaryZones.has(t.target.block.id) && !u(t.target) && d.add(t.target);
					let f = () => {
						let t = 0;
						for (let n of e) n.role === "primary" && (n.source === s || n.target === s || d.has(n.source) || d.has(n.target)) && Math.abs(n.by - (n.ay + Qi(n, e))) < .5 && t++;
						return t;
					};
					for (let u of d) {
						let d = u.x, m = u.y, v = ji(e, t, s, u), y = f(), b = Ti(e, t, s, o.x, o.y, s.flip, u, d, m + g, u.flip, r, i, a);
						if (!Number.isNaN(b)) {
							let i = ji(e, t, s, u) - v, a = f() - y, x = Math.max(i, i >= 0 ? a : 0);
							x > 0 && b <= x * n && pi(e, t, r) <= p && (!h || x > h.gain || x === h.gain && _ < h.reach) && (h = {
								x: o.x,
								y: o.y,
								partner: u,
								px: d,
								py: m + g,
								gain: x,
								reach: _
							}), s.x = c, s.y = l, u.x = d, u.y = m, wi(e, s, u);
						} else if (g > 0) {
							s.y = o.y, u.y = m + g;
							let c = t.filter((e) => e !== s && e !== u && (s.x < e.x + e.block.width + i && e.x < s.x + s.block.width + i && s.y < e.y + e.block.height + a && e.y < s.y + s.block.height + a || u.x < e.x + e.block.width + i && e.x < u.x + u.block.width + i && u.y < e.y + e.block.height + a && e.y < u.y + u.block.height + a));
							s.y = l, u.y = m;
							let v = c[0];
							if (c.length === 1 && v && v.y >= l + s.block.height) {
								let c = v.y, y = bi(e, t, r), b = ji(e, t), x = f();
								if (s.y = o.y, u.y = m + g, v.y = c + g, Ci(s, t, i, a) && Ci(u, t, i, a) && Ci(v, t, i, a)) {
									$(e);
									let i = ji(e, t) - b, a = f() - x, s = Math.max(i, i >= 0 ? a : 0), l = bi(e, t, r) - y;
									s > 0 && l <= s * n && pi(e, t, r) <= p && (!h || s > h.gain || s === h.gain && _ < h.reach) && (h = {
										x: o.x,
										y: o.y,
										partner: u,
										px: d,
										py: m + g,
										third: v,
										ty: c + g,
										gain: s,
										reach: _
									});
								}
								s.y = l, u.y = m, v.y = c, $(e);
							}
						}
					}
				}
			}
			h && (s.x = h.x, s.y = h.y, h.partner && (h.partner.x = h.px, h.partner.y = h.py), h.third && h.ty !== void 0 ? (h.third.y = h.ty, $(e)) : wi(e, s, h.partner), o = !0);
		}
		if (!o) break;
	}
}
function ea(e, t, n = 420, r, i = 60) {
	$(e);
	for (let a = 0; a < 2; a++) {
		let a = !1;
		for (let o of t) {
			let s = o.x, c = o.y, l = gi(e, t, !0);
			if (l.jogs === 0) return;
			let u = pi(e, t, r), d;
			for (let a of e) {
				if (a.source !== o && a.target !== o) continue;
				let f = a.source === o ? 1 : -1, p = (a.bx - a.ax) * f, m = (a.by - a.ay) * f, h = [];
				Math.abs(m) >= .5 && Math.abs(m) <= 120 && h.push({
					x: s,
					y: c + m
				}), Math.abs(p) >= .5 && Math.abs(p) <= 120 && h.push({
					x: s + p,
					y: c
				});
				for (let a of h) {
					let f = Math.abs(a.x - s) + Math.abs(a.y - c), p = Ti(e, t, o, a.x, a.y, o.flip, void 0, 0, 0, 0, r, i);
					if (Number.isNaN(p)) continue;
					let m = gi(e, t, !0), h = l.jogs - m.jogs;
					h > 0 && m.orthoPrimaryCrossings <= l.orthoPrimaryCrossings && m.sharedCrossings <= l.sharedCrossings && pi(e, t, r) <= u && p <= h * n && (!d || h > d.drop || h === d.drop && f < d.reach) && (d = {
						x: a.x,
						y: a.y,
						drop: h,
						reach: f
					}), o.x = s, o.y = c, wi(e, o, void 0);
				}
			}
			d && (o.x = d.x, o.y = d.y, wi(e, o, void 0), a = !0);
		}
		if (!a) break;
	}
}
// src/layout/zoneRefine.ts
function ta(e, t, n) {
	let r = e <= 16 && t <= 75;
	return {
		slackRanks: r,
		orderSweeps: t <= 100 ? 4 : t <= 160 ? 3 : 2,
		verticalSwapPasses: r ? t <= 45 ? 3 : t <= 65 ? 2 : 1 : 0,
		coupledSwapPasses: +!!r,
		flipBitmaskCap: 7,
		polishSteps: n ? [
			128,
			64,
			32,
			16
		] : [],
		polishPasses: n ? t <= 80 ? 3 : 2 : 0
	};
}
function na(e) {
	return {
		...e,
		nodes: new Map([...e.nodes].map(([e, t]) => [e, { ...t }]))
	};
}
function ra(e) {
	return [...e.entries()].sort((e, t) => e[1].y - t[1].y).map(([e]) => e);
}
function ia(e) {
	let t;
	for (let n of e.nodes.values()) {
		let e = Math.round(n.y);
		if (t === void 0) t = e;
		else if (e !== t) return !0;
	}
	return !1;
}
function aa(e, t, n) {
	return new Map(e.map((e) => {
		let r = t.get(e.block.id), i = ra(e.block.nodes), a = r !== void 0 && (i.length !== r.length || i.some((e, t) => e !== r[t])), o = n.get(e.block.id), s = {
			x: e.x,
			y: e.y,
			flip: e.flip
		};
		return a && (s.order = i), o && (s.ranks = o), [e.block.id, s];
	}));
}
function oa(e, t, n, r, i, a) {
	let o = new Set(V(e.groups).map((e) => e.id)), s = /* @__PURE__ */ new Map();
	for (let e of n) {
		if (!o.has(e.id) || e.nodes.size < 2 || e.recursive) continue;
		let n = [...e.nodes.keys()], c = new Set(n), l = Jn(c, t, r, i).forwardEdges, u = An(n, l), d = Math.max(0, ...u.rank.values());
		if (d < 1) continue;
		let f = [...new Set([...e.nodes.values()].map((e) => Math.round(e.x)))].sort((e, t) => e - t);
		if (f.length <= d) continue;
		let p = new Map(n.map((e) => [e, []]));
		for (let [e, t] of l) (u.rank.get(e) ?? 0) < (u.rank.get(t) ?? 0) && p.get(e)?.push(t);
		if (!n.some((e) => (u.rank.get(e) ?? 0) < d && (a.get(e) ?? []).some((e) => !c.has(e)))) continue;
		let m = [...n].sort((e, t) => (u.rank.get(t) ?? 0) - (u.rank.get(e) ?? 0));
		s.set(e.id, {
			nodeIds: n,
			idSet: c,
			ranks: u,
			maxRank: d,
			colRelXs: f,
			fwd: p,
			revTopo: m
		});
	}
	return s;
}
function sa(e, t, n, r, i, a, o, s, c, l, u, d, f) {
	let p = /* @__PURE__ */ new Map();
	if (f && !f.slackRanks || c.size === 0) return p;
	let m;
	for (let f of n) {
		let h = f.block.id, g = c.get(h);
		if (!g) continue;
		let { nodeIds: _, idSet: v, ranks: y, maxRank: b, colRelXs: x, fwd: S, revTopo: C } = g, w = mr(n), T = w.groups[h]?.x ?? f.x, E = (e) => (w.nodes[e]?.x ?? 0) + W.width / 2, D = (e) => {
			let t = new Map(y.rank), n = /* @__PURE__ */ new Map();
			for (let e of _) {
				let r = a.get(e) ?? "", i = n.get(r);
				i || (i = new Int32Array(b + 1), n.set(r, i));
				let o = t.get(e) ?? 0;
				i[o] = (i[o] ?? 0) + 1;
			}
			let r = !1;
			for (let i of C) {
				let s = y.rank.get(i) ?? 0, c = S.get(i) ?? [], l = c.length === 0 ? b : Math.min(b, ...c.map((e) => (t.get(e) ?? b) - 1));
				if (s >= l) continue;
				let d = (o.get(i) ?? []).filter((e) => !v.has(e) && w.nodes[e]);
				if (d.length === 0) continue;
				let f = a.get(i) ?? "", p = n.get(f);
				if (!p) continue;
				p[s] = (p[s] ?? 1) - 1;
				let m = Math.min(...p), h = s, g = Infinity;
				for (let t = s; t <= l; t++) {
					let n = T + (x[t] ?? 0) + W.width / 2, r = t * 2;
					for (let e of d) {
						let t = u.byPair.get(q(i, e))?.role ?? "static", a = t === "primary" ? 1 : t === "return" ? .25 : .1;
						r += Math.abs(n - E(e)) * a;
					}
					r += Math.max(0, (p[t] ?? 0) - m) * e, r < g && (g = r, h = t);
				}
				p[h] = (p[h] ?? 0) + 1, h !== s && (t.set(i, h), r = !0);
			}
			return r ? t : void 0;
		}, O = f.block, k = f.x, A = O, j = k, M, N;
		for (let a of [0, 260]) {
			let o = D(a);
			if (!o) continue;
			let s = `${h}|${[...o.entries()].map(([e, t]) => `${e}:${t}`).join(",")}`;
			if (N ||= /* @__PURE__ */ new Set(), N.has(s)) continue;
			if (N.add(s), m === void 0) {
				let t = ki(e, n, u);
				$(t), m = Pi(e, n, t, u, d, {
					mode: "flip",
					layout: w
				});
			}
			let c = l.get(s);
			c || (c = Yn(e, h, t, o, i, r, u), l.set(s, c));
			let p = na(c);
			for (let t of /* @__PURE__ */ new Set([k, k + O.width - p.width])) if (f.block = p, f.x = t, Ci(f, n)) {
				let r = ki(e, n, u);
				$(r);
				let i = Pi(e, n, r, u, d, { mode: "flip" });
				i < m - 1 && (m = i, A = p, j = t, M = o);
			}
			f.block = O, f.x = k;
		}
		if (M) {
			f.block = A, f.x = j, s.set(h, ra(A.nodes));
			let e = {};
			for (let [t, n] of M) n !== (y.rank.get(t) ?? 0) && (e[t] = n);
			p.set(h, e);
		}
	}
	return p;
}
function ca(e, t, n, r, i, a, o) {
	if (a.orderSweeps <= 0) return !1;
	let s = Infinity, c = Infinity, l = 0;
	for (let t of e) t.x < s && (s = t.x), t.y < c && (c = t.y), l += t.block.nodes.size;
	if (l < 2 || i.length === 0) return !1;
	let u = a.verticalSwapPasses > 0 || a.coupledSwapPasses > 0, d = /* @__PURE__ */ new Map(), f = new Float64Array(l), p = new Float64Array(l), m = new Float64Array(e.length);
	e.forEach((e, t) => {
		let n = Math.round(e.x - s + G.x), r = Math.round(e.y - c + G.y);
		m[t] = r;
		for (let [t, i] of e.block.nodes) {
			let a = d.size;
			d.set(t, a), f[a] = n + i.x + i.width / 2, p[a] = r + (e.flip ? Z(e.block, i, t) : i.y) + 50;
		}
	});
	let h = i.length, g = new Int32Array(h), _ = new Int32Array(h), v = new Uint8Array(h), y = new Uint8Array(h), x = new Float64Array(h), S = new Float64Array(h), C = new Float64Array(h), w = new Float64Array(h), T = new Float64Array(h), E = new Float64Array(h), D = new Float64Array(h), O = new Float64Array(h), k = Array.from({ length: l }, () => []), A = 0;
	for (let [e, t] of i) {
		let r = d.get(e), i = d.get(t);
		if (r === void 0 || i === void 0) continue;
		let a = A++;
		g[a] = r, _[a] = i, v[a] = +(n.get(e) === n.get(t));
		let s = o.byPair.get(q(e, t))?.role ?? "static";
		y[a] = s === "primary" ? 2 : +(s === "return");
		let c = f[r] ?? 0, l = f[i] ?? 0, u = p[r] ?? 0, m = p[i] ?? 0;
		x[a] = c, C[a] = l, T[a] = Math.min(c, l), E[a] = Math.max(c, l), S[a] = u, w[a] = m, D[a] = Math.min(u, m), O[a] = Math.max(u, m), k[r]?.push(a), k[i]?.push(a);
	}
	if (A === 0) return !1;
	let j = new Int32Array(A), M = 0, N = [], P = (e) => {
		let t = ++M;
		N.length = 0;
		for (let n of e) {
			let e = k[n];
			if (e) for (let n of e) j[n] !== t && (j[n] = t, N.push(n));
		}
		return t;
	}, F = () => {
		for (let e of N) {
			let t = p[g[e] ?? 0] ?? 0, n = p[_[e] ?? 0] ?? 0;
			S[e] = t, w[e] = n, D[e] = Math.min(t, n), O[e] = Math.max(t, n);
		}
	}, ee = !1, I = (e) => {
		let t = 0, n = 0, r = 0;
		for (let i of N) {
			let a = S[i] ?? 0, o = w[i] ?? 0, s = Math.abs(a - o), c = y[i] ?? 0;
			r += s * (c === 2 ? 1 : c === 1 ? .35 : .2), u && v[i] === 1 && s >= 1 && (n += c === 2 ? .9 : .2);
			let l = T[i] ?? 0, d = E[i] ?? 0, f = D[i] ?? 0, p = O[i] ?? 0, m = g[i] ?? 0, h = _[i] ?? 0, b = x[i] ?? 0, k = C[i] ?? 0, M = k - b, N = o - a;
			for (let n = 0; n < A; n++) {
				if (n === i || j[n] === e && n < i || d <= (T[n] ?? 0) || (E[n] ?? 0) <= l || p <= (D[n] ?? 0) || (O[n] ?? 0) <= f) continue;
				let r = g[n] ?? 0, s = _[n] ?? 0;
				if (m === r || m === s || h === r || h === s) continue;
				let u = x[n] ?? 0, v = S[n] ?? 0, A = C[n] ?? 0, P = w[n] ?? 0, F = M * (v - a) - N * (u - b), I = M * (P - a) - N * (A - b);
				if (Math.sign(F) * Math.sign(I) >= 0) continue;
				let te = A - u, ne = P - v, re = te * (a - v) - ne * (b - u), L = te * (o - v) - ne * (k - u);
				if (Math.sign(re) * Math.sign(L) < 0) {
					let e = y[n] ?? 0, r = Math.min(c, e), i = Math.max(c, e);
					t += ee ? r === 2 ? 2.5 : i === 2 ? 1.35 : .85 : r === 2 ? 2.5 : i === 2 ? 1.2 : .5;
				}
			}
		}
		return {
			cross: t,
			broken: n,
			span: r
		};
	}, te = new Float64Array(l), ne = !1;
	for (let s = 0; s < a.orderSweeps; s++) {
		let s = !1;
		if (e.forEach((c, l) => {
			if (c.block.nodes.size < 2) return;
			ee = e.length >= 7 && c.block.flippable, te.set(p);
			let h = m[l] ?? 0, g = (c.flip ? c.block.groupsFlipped : c.block.groups).get(c.block.id), _ = g ? h + g.y - 60 : -Infinity, v = g ? h + g.y + g.height + 60 : Infinity, y = /* @__PURE__ */ new Map();
			for (let e of c.block.nodes.entries()) {
				let [n, r] = e;
				b(y, `${t.get(n) ?? ""}|${Math.round(r.x)}`, e);
			}
			for (let e of y.values()) {
				if (e.length < 2) continue;
				let t = new Set(e.map(([e]) => e)), i = e.map(([e]) => d.get(e) ?? 0), l = e.map(([e, i]) => {
					let a = d.get(e) ?? 0, s = f[a] ?? 0, l = te[a] ?? 0, m = 0, h = 0;
					for (let i of r.get(e) ?? []) {
						if (t.has(i)) continue;
						let r = d.get(i);
						if (r === void 0) continue;
						let a = te[r] ?? 0;
						if (u) {
							let t = Math.min(v, Math.max(_, a)), l = Math.abs((f[r] ?? 0) - s), u = n.get(i) === c.block.id ? 2.5 : 1, d = o.byPair.get(q(e, i))?.role ?? "static", p = u * (d === "primary" ? 1 : d === "return" ? .35 : .2) / Math.max(160, l * .8);
							m += p, h += t * p;
						} else m += 1, h += a;
					}
					return {
						id: e,
						idx: a,
						r: i,
						oldY: i.y,
						cur: p[a] ?? 0,
						target: m > 0 ? h / m : l
					};
				}), m = e.map(([, e]) => e.y).sort((e, t) => e - t);
				c.flip && m.reverse();
				let g = [...l].sort((e, t) => e.target - t.target || e.cur - t.cur);
				if (!g.every((e, t) => e.oldY === m[t])) {
					let e = P(i);
					if (N.length > 0) {
						let t = I(e);
						g.forEach((e, t) => {
							let n = m[t] ?? e.oldY;
							e.r.y = n, p[e.idx] = h + (c.flip ? Z(c.block, e.r, e.id) : n) + 50;
						}), F();
						let n = I(e), r = n.cross - t.cross + (n.broken - t.broken), i = n.span - t.span;
						if (r < -1e-6 || Math.abs(r) <= 1e-6 && i < -.5) s = !0, ne = !0;
						else {
							for (let e of l) e.r.y = e.oldY, p[e.idx] = e.cur;
							F();
						}
					}
				}
				if (a.verticalSwapPasses <= 0) continue;
				let y = [...e].sort((e, t) => c.flip ? t[1].y - e[1].y : e[1].y - t[1].y);
				for (let e = 0; e < a.verticalSwapPasses; e++) {
					let e = !1;
					for (let t = 0; t < y.length; t++) for (let n = t + 1; n < y.length; n++) {
						let r = y[t], i = y[n];
						if (!r || !i) continue;
						let [a, o] = r, [l, u] = i, f = d.get(a) ?? 0, m = d.get(l) ?? 0, g = P([f, m]);
						if (N.length === 0) continue;
						let _ = I(g), v = o.y, b = u.y, x = p[f] ?? 0, S = p[m] ?? 0;
						o.y = b, u.y = v, p[f] = h + (c.flip ? Z(c.block, o, a) : b) + 50, p[m] = h + (c.flip ? Z(c.block, u, l) : v) + 50, F();
						let C = I(g), w = C.cross - _.cross + (C.broken - _.broken), T = C.span - _.span;
						w < -1e-6 || Math.abs(w) <= 1e-6 && T < -.5 ? (y[t] = [l, u], y[n] = [a, o], s = !0, ne = !0, e = !0) : (o.y = v, u.y = b, p[f] = x, p[m] = S, F());
					}
					if (!e) break;
				}
			}
			if (a.coupledSwapPasses > 0 && c.block.flippable && y.size >= 2) {
				let e = [];
				for (let [n, r] of i) {
					let i = c.block.nodes.get(n), a = c.block.nodes.get(r);
					if (!i || !a) continue;
					let o = t.get(n) ?? "";
					if (o !== (t.get(r) ?? "")) continue;
					let s = Math.round(i.x), l = Math.round(a.x);
					s !== l && (s < l ? e.push({
						parent: o,
						u: n,
						v: r,
						rU: i,
						rV: a,
						xU: s,
						xV: l
					}) : e.push({
						parent: o,
						u: r,
						v: n,
						rU: a,
						rV: i,
						xU: l,
						xV: s
					}));
				}
				for (let t = 0; t < a.coupledSwapPasses; t++) {
					let t = !1;
					for (let n = 0; n < e.length; n++) for (let r = n + 1; r < e.length; r++) {
						let i = e[n], a = e[r];
						if (!i || !a || i.parent !== a.parent || i.xU !== a.xU || i.xV !== a.xV || i.u === a.u || i.v === a.v) continue;
						let o = d.get(i.u) ?? 0, l = d.get(i.v) ?? 0, u = d.get(a.u) ?? 0, f = d.get(a.v) ?? 0, m = P([
							o,
							l,
							u,
							f
						]);
						if (N.length === 0) continue;
						let g = I(m), _ = i.rU.y, v = a.rU.y, y = i.rV.y, b = a.rV.y, x = p[o] ?? 0, S = p[u] ?? 0, C = p[l] ?? 0, w = p[f] ?? 0;
						i.rU.y = v, a.rU.y = _, i.rV.y = b, a.rV.y = y, p[o] = h + (c.flip ? Z(c.block, i.rU, i.u) : v) + 50, p[u] = h + (c.flip ? Z(c.block, a.rU, a.u) : _) + 50, p[l] = h + (c.flip ? Z(c.block, i.rV, i.v) : b) + 50, p[f] = h + (c.flip ? Z(c.block, a.rV, a.v) : y) + 50, F();
						let T = I(m), E = T.cross - g.cross + (T.broken - g.broken), D = T.span - g.span;
						E < -1e-6 || Math.abs(E) <= 1e-6 && D < -.5 ? (s = !0, ne = !0, t = !0) : (i.rU.y = _, a.rU.y = v, i.rV.y = y, a.rV.y = b, p[o] = x, p[u] = S, p[l] = C, p[f] = w, F());
					}
					if (!t) break;
				}
			}
		}), !s) break;
	}
	return ne;
}
function la(e, t, n) {
	let r = n ?? e.entryMask, i = e.flippability ?? "flippable", a = e.rowFilter ?? "multi-row", o = e.fallback ?? "score-greedy", s = e.targets ?? e.placed, c = (e) => i === "flippable" ? e.block.flippable : !e.block.flippable, l = (e) => a === "multi-row" ? ia(e.block) : a !== "multi-node" || e.block.nodes.size >= 2, u = s.filter((e) => c(e) && l(e)), d = (t) => {
		if (!e.symmetryGroups || e.symmetryGroups.size === 0) return t.map((e) => [e]);
		let n = [], r = /* @__PURE__ */ new Map();
		for (let i of t) {
			let t = e.symmetryGroups.get(i.block.id);
			if (t === void 0) n.push([i]);
			else {
				let e = r.get(t);
				e || (e = [], r.set(t, e), n.push(e)), e.push(i);
			}
		}
		return n;
	}, f = d(u), p = Math.min(t, 20);
	if (i === "flippable" && p > 0 && f.length > 0 && f.length <= p) {
		let t = {
			mode: "flip",
			...e.preserveFlowOverride === void 0 ? {} : { preserveFlowOverride: e.preserveFlowOverride },
			...r ? { entryMask: r } : {}
		}, n = 0;
		f.forEach((e, t) => {
			e[0]?.flip === 1 && (n |= 1 << t);
		}), $(e.links);
		let i = n, a = Pi(e.doc, e.placed, e.links, e.flow, e.flowCtx, t), o = a, s = 1 << f.length;
		for (let r = 0; r < s; r++) {
			if (r === n) continue;
			f.forEach((e, t) => {
				let n = r >> t & 1;
				for (let t of e) t.flip = n;
			}), $(e.links);
			let s = Pi(e.doc, e.placed, e.links, e.flow, e.flowCtx, t);
			s < a && s < o - 1 && (a = s, i = r);
		}
		return f.forEach((e, t) => {
			let n = i >> t & 1;
			for (let t of e) t.flip = n;
		}), $(e.links), i !== n;
	}
	if (o === "none") return !1;
	let m = d(e.fallbackTargets ? e.fallbackTargets.filter(c) : u);
	if (m.length === 0) return !1;
	let h = {
		mode: "flip",
		...e.preserveFlowOverride === void 0 ? {} : { preserveFlowOverride: e.preserveFlowOverride },
		...r ? { entryMask: r } : {}
	};
	$(e.links);
	let g = Pi(e.doc, e.placed, e.links, e.flow, e.flowCtx, h), _ = !1;
	for (let t of m) {
		let n = t.map((e) => e.flip), r = +(n[0] === 0);
		for (let e of t) e.flip = r;
		t.length === 1 && t[0] ? wi(e.links, t[0], void 0) : $(e.links);
		let i = Pi(e.doc, e.placed, e.links, e.flow, e.flowCtx, h);
		i < g - 1 ? (g = i, _ = !0) : (t.forEach((e, t) => {
			e.flip = n[t] ?? 0;
		}), t.length === 1 && t[0] ? wi(e.links, t[0], void 0) : $(e.links));
	}
	return _;
}
function ua(e, t, n, r, i, a, o = 60, s = !1) {
	if (a.polishPasses <= 0 || a.polishSteps.length === 0 || e.length === 0) return !1;
	let c = /* @__PURE__ */ new Map();
	if (s && i.preserveFlow && i.auxiliaryZones.size > 0) {
		let t = Infinity, n = -Infinity;
		for (let r of e) i.auxiliaryZones.has(r.block.id) || (t = Math.min(t, r.y), n = Math.max(n, r.y + r.block.height));
		if (Number.isFinite(t)) for (let r of e) i.auxiliaryZones.has(r.block.id) && (r.y + r.block.height <= t + 1e-6 ? c.set(r.block.id, "above") : r.y >= n - 1e-6 && c.set(r.block.id, "below"));
	}
	let l = () => {
		if (c.size === 0) return !0;
		let t = Infinity, n = -Infinity;
		for (let r of e) i.auxiliaryZones.has(r.block.id) || (t = Math.min(t, r.y), n = Math.max(n, r.y + r.block.height));
		if (!Number.isFinite(t)) return !0;
		for (let r of e) {
			let e = c.get(r.block.id);
			if (e === "above" && r.y + r.block.height > t - 58 || e === "below" && r.y < n + 58) return !1;
		}
		return !0;
	};
	$(t);
	let u = Fi(e, n, r), d = Ni(t, i), f = Ii(u, e, t, i, d), p = !1;
	for (let n of a.polishSteps) for (let r = 0; r < a.polishPasses; r++) {
		let r = !1;
		for (let a of e) {
			let s = a.x, c = a.y, m;
			for (let [r, p] of [
				[0, -n],
				[0, n],
				[-n, 0],
				[n, 0]
			]) {
				if (a.x = s + r, a.y = c + p, !Ci(a, e, o) || !l()) continue;
				wi(t, a, void 0);
				let n = Ni(t, i);
				if (n > d) continue;
				let h = Ii(u, e, t, i, n);
				h < f - 1 && (!m || h < m.obj) && (m = {
					x: a.x,
					y: a.y,
					obj: h,
					backPri: n
				});
			}
			m ? (a.x = m.x, a.y = m.y, f = m.obj, d = m.backPri, wi(t, a, void 0), r = !0, p = !0) : (a.x = s, a.y = c, wi(t, a, void 0));
		}
		if (!r) break;
	}
	return p;
}
// src/layout/nestedZone.ts
var da = (e, t) => e < t ? -1 : +(e > t);
function fa(e) {
	let t = V(e.groups);
	if (t.length !== 1 || !t[0]) return !1;
	let n = t[0].id, r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set();
	for (let t of e.groups) t.parentId !== void 0 && (r.set(t.parentId, (r.get(t.parentId) ?? 0) + 1), t.parentId === n && i.add(t.id));
	if (i.size === 0 || !e.groups.some((e) => e.parentId !== void 0 && i.has(e.parentId))) return !1;
	for (let e of r.values()) if (e >= 2) return !0;
	return !1;
}
function pa(e, t) {
	let n = Lt(e.groups), r = /* @__PURE__ */ new Map();
	for (let i of e.groups) {
		let e = i.id, a = i.id;
		for (; e !== void 0 && e !== t;) a = e, e = n.get(e);
		e === t && i.id !== t && r.set(i.id, a);
	}
	let i = /* @__PURE__ */ new Map();
	for (let [e, t] of r) i.set(e, t);
	for (let n of e.nodes) if (n.parentId === t) i.set(n.id, n.id);
	else if (n.parentId !== void 0) {
		let e = r.get(n.parentId);
		e !== void 0 && i.set(n.id, e);
	}
	return i;
}
function ma(e, t, n, r) {
	let i = /* @__PURE__ */ new Map(), a = n.egressReturnPairs ?? /* @__PURE__ */ new Set();
	for (let o of t) {
		let t = e.groups.filter((e) => e.parentId === o.id), s = e.nodes.filter((e) => e.parentId === o.id);
		if (t.length === 0 && s.length < 2) continue;
		let c = pa(e, o.id), l = [...t.map((e) => e.id), ...s.map((e) => e.id)], u = new Map(l.map((e) => [e, 0]));
		for (let e of c.values()) u.set(e, (u.get(e) ?? 0) + 1);
		let d = new Map(t.map((t) => [t.id, e.groups.filter((e) => e.parentId === t.id).length])), f = new Map(l.map((e) => [e, [
			0,
			0,
			0,
			0,
			0,
			0
		]]));
		for (let e of n.connections) {
			let t = c.get(e.from), n = c.get(e.to);
			if (!t || !n || t === n) continue;
			let r = f.get(t), i = f.get(n);
			r && i && (e.role === "primary" ? (r[1]++, i[0]++) : e.role === "static" && (a.has(q(e.from, e.to)) ? (r[5]++, i[4]++) : (r[3]++, i[2]++)));
		}
		let p = l.map((e) => {
			let t = +!!d.has(e), n = f.get(e) ?? [
				0,
				0,
				0,
				0,
				0,
				0
			];
			return `${t}:${u.get(e) ?? 0}:${d.get(e) ?? 0}:${n.join(",")}`;
		}).sort();
		b(i, `${r.zoneStage.get(o.id) ?? 0}|${+!!r.auxiliaryZones.has(o.id)}|${t.length}|${s.length}|${p.join(";")}`, o.id);
	}
	let o = /* @__PURE__ */ new Map(), s = 1;
	for (let e of i.values()) {
		if (e.length < 2) continue;
		let t = s++;
		for (let n of e) o.set(n, t);
	}
	return o;
}
function ha(e, t) {
	if (t <= e.width) return e;
	let n = Math.round((t - e.width) / 2), r = (e) => ({
		...e,
		x: e.x + n
	}), i = new Map([...e.nodes].map(([e, t]) => [e, r(t)])), a = new Map([...e.groups].map(([n, i]) => [n, n === e.id ? {
		...i,
		width: t
	} : r(i)])), o = new Map([...e.groupsFlipped].map(([n, i]) => [n, n === e.id ? {
		...i,
		width: t
	} : r(i)]));
	return {
		...e,
		width: t,
		nodes: i,
		groups: a,
		groupsFlipped: o
	};
}
function ga(e, t) {
	if (t.length < 2) return;
	let n = /* @__PURE__ */ new Map();
	for (let r = 0; r < t.length; r++) {
		let i = t[r];
		if (!i || i.groups.size <= 1) continue;
		let a = e.groups.filter((e) => e.parentId === i.id);
		if (a.length < 2 || e.nodes.some((e) => e.parentId === i.id)) continue;
		let o = a.map((e) => ({
			id: e.id,
			r: i.groups.get(e.id)
		})).filter((e) => e.r !== void 0).sort((e, t) => e.r.x - t.r.x || da(e.id, t.id));
		if (o.length !== a.length) continue;
		let s = [];
		for (let { id: e, r: t } of o) {
			let n = s[s.length - 1];
			n && t.x < n.right ? (n.groupIds.push(e), n.x = Math.min(n.x, t.x), n.right = Math.max(n.right, t.x + t.width)) : s.push({
				groupIds: [e],
				x: t.x,
				right: t.x + t.width
			});
		}
		if (s.length < 2) continue;
		let c = `${a.length}|${s.length}`;
		b(n, c, {
			index: r,
			block: i,
			sig: c,
			childCols: s.map((e) => ({
				groupIds: e.groupIds,
				x: e.x,
				w: e.right - e.x
			}))
		});
	}
	for (let r of n.values()) {
		if (r.length < 2) continue;
		let n = Math.min(...r.map((e) => e.block.width)), i = Math.max(...r.map((e) => e.block.width));
		if (n <= 0 || i > n * 1.5) continue;
		let a = r[0]?.childCols.length ?? 0, o = [];
		for (let e = 0; e < a; e++) o.push(Math.max(...r.map((t) => t.childCols[e]?.w ?? 0)));
		let s = [16];
		for (let e = 1; e < a; e++) {
			let t = Math.max(16, ...r.map((t) => {
				let n = t.childCols[e - 1], r = t.childCols[e];
				return n && r ? r.x - (n.x + n.w) : 16;
			}));
			s.push((s[e - 1] ?? 0) + (o[e - 1] ?? 0) + t);
		}
		let c = (s[a - 1] ?? 0) + (o[a - 1] ?? 0) + 16, l = Math.max(c, i), u = Math.round((l - c) / 2);
		if (u > 0) for (let e = 0; e < a; e++) s[e] = (s[e] ?? 0) + u;
		for (let n of r) {
			if (n.block.width === l && n.childCols.every((e, t) => e.x === s[t] && e.w === o[t])) continue;
			let r = pa(e, n.block.id), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
			n.childCols.forEach((e, t) => {
				let r = s[t] ?? e.x, c = o[t] ?? e.w;
				for (let t of e.groupIds) {
					let e = n.block.groups.get(t);
					e && (i.set(t, {
						x: r,
						width: c
					}), a.set(t, r - e.x + Math.round((c - e.width) / 2)));
				}
			});
			let c = (e) => new Map([...e].map(([e, t]) => {
				if (e === n.block.id) return [e, {
					...t,
					width: l
				}];
				let o = i.get(e);
				if (o) return [e, {
					...t,
					x: o.x,
					width: o.width
				}];
				let s = r.get(e), c = s === void 0 ? 0 : a.get(s) ?? 0;
				return [e, c === 0 ? t : {
					...t,
					x: t.x + c
				}];
			})), u = new Map([...n.block.nodes].map(([e, t]) => {
				let n = r.get(e), i = n === void 0 ? 0 : a.get(n) ?? 0;
				return [e, i === 0 ? t : {
					...t,
					x: t.x + i
				}];
			}));
			t[n.index] = {
				...n.block,
				width: l,
				nodes: u,
				groups: c(n.block.groups),
				groupsFlipped: c(n.block.groupsFlipped)
			};
		}
	}
}
function _a(e, t) {
	let { width: n, height: r } = W, i = t.get(e) ?? 0;
	return {
		id: e,
		width: n,
		height: r,
		head: 0,
		contentHeight: r,
		loopRoom: i,
		nodeLoopRoom: i > 0 ? /* @__PURE__ */ new Map([[e, i]]) : /* @__PURE__ */ new Map(),
		flippable: !1,
		nodes: /* @__PURE__ */ new Map([[e, {
			x: 0,
			y: 0,
			width: n,
			height: r
		}]]),
		groups: /* @__PURE__ */ new Map(),
		groupsFlipped: /* @__PURE__ */ new Map(),
		reflectConst: /* @__PURE__ */ new Map()
	};
}
function va(e) {
	return Zt(e.map((e) => {
		let t = e.block.groups.size === 0 ? e.block.loopRoom : 0;
		return {
			x: e.x,
			y: e.y - t,
			width: e.block.width,
			height: e.block.height + t
		};
	}));
}
function ya(e, t, n) {
	let r = e.groups.find((e) => e.id === t)?.label ?? "";
	if (n.length === 0) {
		let e = Gt.width + 32, n = Math.max(e, Jt(r)), i = Yt(r, n) + 16, a = i + Gt.height + 16, o = /* @__PURE__ */ new Map([[t, {
			x: 0,
			y: 0,
			width: n,
			height: a
		}]]);
		return {
			id: t,
			width: n,
			height: a,
			head: i,
			contentHeight: Gt.height,
			loopRoom: 0,
			nodeLoopRoom: /* @__PURE__ */ new Map(),
			flippable: !1,
			nodes: /* @__PURE__ */ new Map(),
			groups: o,
			groupsFlipped: new Map(o),
			reflectConst: /* @__PURE__ */ new Map()
		};
	}
	let i = va(n), a = n.map((e) => ({
		p: e,
		rx: Math.round(e.x - i.x),
		ry: Math.round(e.y - i.y)
	})), o = 0, s = 0, c = 0;
	for (let { p: e, rx: t, ry: n } of a) {
		let r = e.block.groups.size === 0 ? e.block.loopRoom : 0;
		c = Math.min(c, n - r), o = Math.max(o, t + e.block.width), s = Math.max(s, n + e.block.height);
	}
	let l = o, u = s - c, d = l + 32, f = Math.max(d, Jt(r)), p = 16 + Math.round((f - d) / 2), m = Yt(r, f) + 16, h = m + u + 16, g = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map([[t, {
		x: 0,
		y: 0,
		width: f,
		height: h
	}]]), v = /* @__PURE__ */ new Map();
	for (let { p: e, rx: t, ry: n } of a) {
		let { block: r } = e, i = p + t, a = m + n - c;
		for (let [t, n] of r.nodes) g.set(t, {
			...n,
			x: i + n.x,
			y: a + (e.flip ? Z(r, n, t) : n.y)
		});
		for (let [t, n] of e.flip ? r.groupsFlipped : r.groups) _.set(t, {
			...n,
			x: i + n.x,
			y: a + n.y
		});
		for (let [e, t] of r.nodeLoopRoom) v.set(e, t);
	}
	let y = (e) => {
		if (e.parentId !== t) return e;
		let { parentId: n, ...r } = e;
		return r;
	}, { groupsFlipped: b, reflectConst: x } = qn(t, e.nodes.filter((e) => g.has(e.id)).map(y), e.groups.filter((e) => e.id !== t && _.has(e.id)).map(y), 0, g, _);
	return {
		id: t,
		width: f,
		height: h,
		head: m,
		contentHeight: u,
		loopRoom: 0,
		nodeLoopRoom: v,
		flippable: !1,
		nodes: g,
		groups: _,
		groupsFlipped: b,
		reflectConst: x,
		recursive: !0
	};
}
function ba(e, t, n, r, i, a, o, s, c) {
	if (t.length === 0) return [];
	if (t.length === 1 && t[0]) {
		let e = t[0];
		return [{
			block: e,
			x: 0,
			y: e.groups.size === 0 ? e.loopRoom : 0,
			flip: 0
		}];
	}
	let l = /* @__PURE__ */ new Set(), u = new Map(t.map((e) => [e.id, 0])), d = new Map(t.map((e) => [e.id, 0])), f = new Map(t.map((e) => [e.id, !1])), p = i.egressReturnPairs ?? /* @__PURE__ */ new Set();
	for (let e of r.connections) {
		let t = n.get(e.from), r = n.get(e.to);
		t && r && t !== r && (l.add(t), l.add(r), e.role === "primary" ? (u.set(t, (u.get(t) ?? 0) + 1), d.set(r, (d.get(r) ?? 0) + 1)) : e.role === "static" && p.has(q(e.from, e.to)) && f.set(r, !0));
	}
	let m = new Map(t.map((e) => [e.id, 0])), h = new Map(t.map((e) => [e.id, 0])), g = new Map(t.map((e) => [e.id, 0])), _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), y = (e, t, n) => {
		let r = e.get(t);
		(r === void 0 || n < r) && e.set(t, n);
	};
	for (let e of i.connections) {
		let t = n.get(e.from), r = n.get(e.to), a = i.pairFirstStep.get(q(e.from, e.to)) ?? 0;
		e.role === "primary" && (t !== void 0 && y(v, t, a), r !== void 0 && y(v, r, a)), t !== void 0 != (r !== void 0) && (r !== void 0 && (m.set(r, (m.get(r) ?? 0) + 1), e.role === "primary" && (g.set(r, (g.get(r) ?? 0) + 1), y(_, r, a))), t !== void 0 && h.set(t, (h.get(t) ?? 0) + 1));
	}
	let x = /* @__PURE__ */ new Map(), S = 0;
	for (let t of e.groups) x.set(t.id, S++);
	for (let t of e.nodes) x.set(t.id, S++);
	let C = [], w = [], T = [];
	for (let e of t) l.has(e.id) ? C.push(e) : (m.get(e.id) ?? 0) + (h.get(e.id) ?? 0) > 0 ? w.push(e) : T.push(e);
	let E = [...C, ...w];
	if (C.length === 0) {
		let e = [...E.length > 0 ? E : T].sort((e, t) => {
			let n = (h.get(e.id) ?? 0) - (m.get(e.id) ?? 0), r = (h.get(t.id) ?? 0) - (m.get(t.id) ?? 0);
			return o && n !== r ? n - r : da(e.id, t.id);
		}), t = [];
		if (o) {
			let n = Math.max(0, ...e.map((e) => e.height)), r = 0;
			for (let i of e) t.push({
				block: i,
				x: r,
				y: Math.round((n - i.height) / 2),
				flip: 0
			}), r += i.width + c.horizontalClearance;
		} else {
			let n = 0;
			for (let r of e) {
				let e = r.groups.size === 0 ? r.loopRoom : 0;
				t.push({
					block: r,
					x: 0,
					y: n + e,
					flip: 0
				}), n += e + r.height + c.rowGap;
			}
		}
		return E.length === 0 ? t : [...t, ...$n(T, t, c)];
	}
	if (w.length > 0) {
		let e = C.filter((e) => !r.auxiliaryZones.has(e.id)).map((e) => r.zoneStage.get(e.id) ?? 0), t = e.length > 0 ? Math.max(...e) : 0;
		for (let e of w) {
			let n = m.get(e.id) ?? 0, i = h.get(e.id) ?? 0;
			r.zoneStage.set(e.id, i > 0 && n === 0 ? t : 0);
		}
	}
	let { auxiliary: D, columns: O } = er(E, r), k = new Map(a);
	if (s >= 1 && O.length >= 2) {
		let t = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
		for (let e of r.connections) {
			let r = n.get(e.from), c = n.get(e.to);
			if (!r || !c || r === c) continue;
			let l = q(r, c);
			if (a.add(`${r}\0${c}`), e.role === "primary") {
				let n = i.pairFirstStep.get(q(e.from, e.to)) ?? 0, a = `${r}\0${c}`, o = t.get(a);
				(o === void 0 || n < o) && t.set(a, n), e.direction === "bidirectional" && s.add(l);
			} else e.role === "static" && o.add(l);
		}
		let c = (t) => e.groups.filter((e) => e.parentId === t).length, l = Math.max(0, ...k.values()) + 1;
		if (D.length > 0) for (let e = D.length - 1; e >= 0; e--) {
			let n = D[e];
			if (!n || n.groups.size < 1 || n.nodes.size < 2) continue;
			let i = c(n.id), u = !1;
			for (let d = 1; d < O.length && !u; d++) {
				let f = O[d];
				if (f) for (let p of f) {
					if (p.groups.size < 1 || p.nodes.size < 2 || c(p.id) !== i) continue;
					let m = Math.min(p.nodes.size, n.nodes.size);
					if (Math.abs(p.nodes.size - n.nodes.size) > Math.max(1, Math.floor(m / 2))) continue;
					let h = q(p.id, n.id);
					if (!o.has(h) && !s.has(h)) continue;
					let g;
					for (let e of O.slice(0, d)) {
						let r = e.find((e) => t.has(`${e.id}\0${p.id}`) && a.has(`${e.id}\0${n.id}`));
						if (r) {
							g = r.id;
							break;
						}
					}
					if (g !== void 0) {
						if (f.push(n), D.splice(e, 1), r.auxiliaryZones.delete(n.id), r.zoneStage.set(n.id, r.zoneStage.get(p.id) ?? d), r.primaryZonePairs.add(H(g, n.id)), p.nodes.size === n.nodes.size) {
							let e = k.get(p.id) ?? l++;
							k.set(p.id, e), k.set(n.id, e);
						}
						u = !0;
						break;
					}
				}
			}
		}
		let u = /* @__PURE__ */ new Map(), d = (t) => {
			let n = u.get(t);
			return n || (n = pa(e, t), u.set(t, n)), n;
		}, f = (e, t) => {
			let a = c(e.id), o = c(t.id);
			if (a < 2 || o < 2 || Math.abs(a - o) > 1) return !1;
			let s = r.connections.filter((r) => r.role === "primary" && r.direction !== "bidirectional" && n.get(r.from) === e.id && n.get(r.to) === t.id);
			if (s.length === 0 || r.connections.some((r) => r.role === "primary" && r.direction !== "bidirectional" && n.get(r.from) === t.id && n.get(r.to) === e.id)) return !1;
			let l = d(e.id);
			return s.every((e) => {
				let t = l.get(e.from);
				return t !== void 0 && i.connections.some((n) => n.role === "primary" && n.from === e.from && l.has(n.to) && l.get(n.to) !== t);
			});
		};
		for (let e = 0; e < O.length; e++) {
			let n = O[e];
			if (n && n.length !== 0) {
				for (let i of [...n]) if (!(i.groups.size < 1 || i.nodes.size < 2)) for (let a = e + 1; a < O.length; a++) {
					let u = O[a];
					if (u) {
						for (let a = u.length - 1; a >= 0; a--) {
							let d = u[a];
							if (!d || d.groups.size < 1 || d.nodes.size < 2) continue;
							let p = Math.min(i.nodes.size, d.nodes.size);
							if (Math.abs(i.nodes.size - d.nodes.size) > Math.max(1, Math.floor(p / 2))) continue;
							let m = q(i.id, d.id);
							if (!o.has(m) && !s.has(m)) continue;
							let h = c(i.id) === c(d.id);
							if ((h && O.slice(0, e).some((e) => e.some((e) => {
								let n = t.get(`${e.id}\0${i.id}`), r = t.get(`${e.id}\0${d.id}`);
								return n !== void 0 && r !== void 0 && n === r;
							})) || f(i, d)) && (n.push(d), u.splice(a, 1), r.zoneStage.set(d.id, r.zoneStage.get(i.id) ?? e), h && i.nodes.size === d.nodes.size)) {
								let e = k.get(i.id) ?? l++;
								k.set(i.id, e), k.set(d.id, e);
							}
						}
						u.length === 0 && (O.splice(a, 1), a--);
					}
				}
			}
		}
	}
	if (s >= 1 && O.length >= 2) {
		let e = O[0], t = O[1], n = e?.length === 1 ? e[0] : void 0, i = t?.length === 1 ? t[0] : void 0, a = n ? v.get(n.id) : void 0, o = i ? _.get(i.id) : void 0;
		n && i && n.groups.size >= 1 && i.groups.size >= 1 && n.width >= 500 && i.width >= 500 && i.height <= n.height * 2.5 && a !== void 0 && o !== void 0 && a > o && (t.push(n), O.splice(0, 1), r.zoneStage.set(n.id, r.zoneStage.get(i.id) ?? 0));
	}
	if (s >= 1 && O.length >= 2) {
		let e = O[O.length - 1], t = e?.length === 1 ? e[0] : void 0;
		if (t && t.groups.size >= 1 && t.nodes.size >= 2 && (u.get(t.id) ?? 0) === 0 && (m.get(t.id) ?? 0) === 0 && (h.get(t.id) ?? 0) === 0 && O.slice(0, -1).some((e) => e.some((e) => (h.get(e.id) ?? 0) > 0))) {
			let e = O.reduce((e, t) => e + Math.max(0, ...t.map((e) => e.width)), 0) + (O.length - 1) * c.stageGap, n = Math.max(1, ...O.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * c.rowGap));
			e >= 1e3 && e / n >= 2.4 && (O.pop(), D.push(t), r.auxiliaryZones.add(t.id));
		}
	}
	if (s >= 1 && O.length >= 3) {
		let e = O[0], t = O[1], i = O[O.length - 1], a = i?.length === 1 ? i[0] : void 0;
		if (e && t && a && a.groups.size >= 1 && a.width >= 500 && (m.get(a.id) ?? 0) + (h.get(a.id) ?? 0) > 0) {
			let i = new Set(e.map((e) => e.id));
			if (r.connections.some((e) => e.role === "primary" && i.has(n.get(e.from) ?? "") && n.get(e.to) === a.id)) {
				let e = O.reduce((e, t) => e + Math.max(0, ...t.map((e) => e.width)), 0) + (O.length - 1) * c.stageGap, n = Math.max(1, ...O.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * c.rowGap)), i = Math.max(a.width, ...t.map((e) => e.width)), o = t.reduce((e, t) => e + t.height, 0) + a.height + t.length * c.rowGap, s = O.slice(0, -1).reduce((e, t, n) => e + (n === 1 ? i : Math.max(0, ...t.map((e) => e.width))), 0) + (O.length - 2) * c.stageGap, l = Math.max(n, o);
				if (e >= 2200 && e / n >= 2.8 && s / Math.max(1, l) >= 1.4) {
					O.pop(), t.push(a);
					let e = r.zoneStage.get(t[0]?.id ?? "") ?? 1;
					r.zoneStage.set(a.id, e);
					for (let e of O.slice(2)) for (let t of e) r.primaryZonePairs.delete(H(t.id, a.id));
				}
			}
		}
	}
	if (s >= 1) for (let t of O) ga(e, t);
	if ((() => {
		if (s < 1 || D.length > 0 || O.length !== 2) return !1;
		let e = O[0], t = O[1];
		if (!e || !t || e.length !== 1 || t.length !== 1) return !1;
		let n = e[0], r = t[0];
		if (!n || !r || n.groups.size === 0 || r.groups.size === 0 || n.width < 500 || r.width < 500) return !1;
		let i = n.width + c.stageGap + r.width, a = Math.max(n.height, r.height);
		return i <= 1400 || i / Math.max(1, a) <= 2.2 ? !1 : (g.get(r.id) ?? 0) > 0;
	})() && O[0]?.[0] && O[1]?.[0]) {
		let e = O[0][0], t = O[1][0], n = [{
			block: e,
			x: 0,
			y: 0,
			flip: 0
		}, {
			block: t,
			x: 0,
			y: e.height + c.rowGap,
			flip: 0
		}];
		return [...n, ...$n(T, n, c)];
	}
	let A = /* @__PURE__ */ new Map(), j = [], M = O.map((e) => [...e]), N = /* @__PURE__ */ new Map();
	M.forEach((e, t) => {
		for (let n of e) {
			N.set(n.id, t);
			let e = {
				block: n,
				x: 0,
				y: 0,
				flip: 0
			};
			A.set(n.id, e), j.push(e);
		}
	});
	let P = (e) => {
		let t = (u.get(e) ?? 0) + (d.get(e) ?? 0) > 0;
		return !t && f.get(e) ? 0 : t ? 2 : 1;
	}, F = (e, t) => (v.get(e.id) ?? Infinity) - (v.get(t.id) ?? Infinity) || (x.get(e.id) ?? 0) - (x.get(t.id) ?? 0) || da(e.id, t.id), ee = /* @__PURE__ */ new Set();
	if (s >= 1) for (let e of r.connections) {
		let t = n.get(e.from), r = n.get(e.to);
		t && r && t !== r && (e.role === "static" || e.direction === "bidirectional") && ee.add(q(t, r));
	}
	let I = (t) => e.groups.filter((e) => e.parentId === t).length, te = (e, t) => {
		if (s < 1 || e.groups.size < 1 || t.groups.size < 1 || e.nodes.size < 2 || t.nodes.size < 2) return !1;
		let n = k.get(e.id);
		if (n !== void 0 && n === k.get(t.id)) return !0;
		let r = Math.min(e.nodes.size, t.nodes.size);
		return Math.abs(e.nodes.size - t.nodes.size) > Math.max(1, Math.floor(r / 2)) || Math.abs(I(e.id) - I(t.id)) > 1 ? !1 : ee.has(q(e.id, t.id));
	}, ne = (e) => {
		if (s < 1 || e.length < 2) return;
		let t = /* @__PURE__ */ new Set();
		for (let n = 0; n < e.length; n++) {
			if (t.has(n)) continue;
			let r = [n];
			t.add(n);
			for (let n = 0; n < r.length; n++) {
				let i = e[r[n]];
				if (i) for (let n = 0; n < e.length; n++) {
					if (t.has(n)) continue;
					let a = e[n];
					a && te(i, a) && (t.add(n), r.push(n));
				}
			}
			if (r.length < 2) continue;
			r.sort((e, t) => e - t);
			let i = r.map((t) => e[t]).sort((e, t) => (x.get(e.id) ?? 0) - (x.get(t.id) ?? 0) || da(e.id, t.id));
			r.forEach((t, n) => {
				e[t] = i[n];
			});
		}
	};
	for (let e of M) e.length < 2 || (e.sort((e, t) => P(e.id) - P(t.id) || (u.get(e.id) ?? 0) - (u.get(t.id) ?? 0) || F(e, t)), ne(e));
	let re = () => {
		let e = M.map((e) => e.reduce((e, t) => e + t.height + (t.groups.size === 0 ? t.loopRoom : 0), 0) + Math.max(0, e.length - 1) * c.rowGap), t = Math.max(0, ...e), n = 0;
		M.forEach((r, i) => {
			let a = Math.max(0, ...r.map((e) => e.width)), o = (t - (e[i] ?? 0)) / 2;
			for (let e of r) {
				let t = e.groups.size === 0 ? e.loopRoom : 0, r = A.get(e.id);
				r && (r.x = n + (a - e.width) / 2, r.y = o + t), o += t + e.height + c.rowGap;
			}
			n += a + c.stageGap;
		});
	};
	re();
	let L = /* @__PURE__ */ new Map();
	for (let e of r.connections) {
		let t = n.get(e.from), i = n.get(e.to);
		if (!t || !i || t === i || r.auxiliaryZones.has(t) || r.auxiliaryZones.has(i)) continue;
		let a = e.role === "primary" ? 3 : e.role === "return" ? .6 : .08;
		b(L, t, {
			id: i,
			otherNode: e.to,
			w: a
		}), b(L, i, {
			id: t,
			otherNode: e.from,
			w: a
		});
	}
	let ie = (e, t) => {
		let n = e.block.nodes.get(t);
		return e.y + (n ? n.y + 50 : e.block.height / 2);
	};
	for (let e = 0; e < 4; e++) {
		let t = e % 2 == 0 ? M.map((e, t) => t) : M.map((e, t) => M.length - 1 - t);
		for (let e of t) {
			let t = M[e];
			!t || t.length < 2 || (t.sort((t, n) => {
				let r = (t) => {
					let n = 0, r = 0;
					for (let { id: i, otherNode: a, w: o } of L.get(t) ?? []) {
						if (N.get(i) === e) continue;
						let t = A.get(i);
						t && (r += ie(t, a) * o, n += o);
					}
					return n > 0 ? r / n : Infinity;
				}, i = r(t.id), a = r(n.id);
				return Math.abs(i - a) > 1e-6 ? i - a : P(t.id) - P(n.id) || F(t, n);
			}), ne(t), re());
		}
	}
	let ae = r.hasAnimate, R = c.horizontalClearance, oe = c.verticalClearance, se = Zr(r, n, ae, !1, void 0, R);
	if (j.length >= 2) {
		let t = ki(e, j, r);
		$(t), la({
			doc: e,
			placed: j,
			links: t,
			flow: r,
			flowCtx: se,
			rowFilter: "any",
			fallback: "score-greedy",
			symmetryGroups: k
		}, 5), Xi(t, j, !1, se, R, oe), qi(t, j, se, R, oe), Xi(t, j, !1, se, R, oe), $i(t, j, 200, se, R, oe);
	}
	let ce = [...j];
	if (D.length > 0) {
		let t = D.map((e) => ({
			block: e,
			x: 0,
			y: 0,
			flip: 0
		})), i = ur(t, j, n, r, {
			auxMode: "bands",
			cols: M,
			sideMode: "stationY",
			clampMaxSource: !0,
			decayStatic: !0,
			spacing: c
		});
		if (s >= 1 && M.length >= 2 && j.length >= 2) {
			let e = c.auxGap, i = t.reduce((e, t) => e + t.block.width, 0) + Math.max(0, t.length - 1) * c.horizontalClearance, a = Math.max(0, ...t.map((e) => e.block.height)), o = Math.min(...j.map((e) => e.y)), s = Math.max(...j.map((e) => e.y + e.block.height)), l = s - o, u = M.map((e) => {
				let t = e.map((e) => A.get(e.id)).filter((e) => e !== void 0), n = Math.min(...t.map((e) => e.x)), r = Math.max(...t.map((e) => e.x + e.block.width)), i = Math.min(...t.map((e) => e.y)), a = Math.max(...t.map((e) => e.y + e.block.height));
				return {
					items: t,
					minX: n,
					maxR: r,
					minY: i,
					maxB: a,
					w: r - n,
					h: a - i
				};
			}), d = new Set(t.map((e) => e.block.id)), f = /* @__PURE__ */ new Map();
			for (let e of r.connections) {
				let t = n.get(e.from), r = n.get(e.to);
				t && r && t !== r && (d.has(t) && !d.has(r) ? f.set(r, (f.get(r) ?? 0) + 1) : d.has(r) && !d.has(t) && f.set(t, (f.get(t) ?? 0) + 1));
			}
			let p = [...d].reduce((e, t) => e + (m.get(t) ?? 0), 0), g = [...d].reduce((e, t) => e + (h.get(t) ?? 0), 0), _;
			for (let t of [0, M.length - 1]) {
				let n = u[t];
				if (!n || n.h + e + a > l + 24) continue;
				let r = t === 0 ? u[1] : void 0, d = t === M.length - 1 ? u[t - 1] : void 0, m = Math.round(n.minX + (n.w - i) / 2);
				if (r) {
					let e = r.minX - c.horizontalClearance;
					if (m + i > e && (m = Math.round(e - i)), m < n.minX - 40) continue;
				}
				if (d) {
					let e = d.maxR + c.horizontalClearance;
					if (m < e && (m = Math.round(e)), m + i > n.maxR + 40) continue;
				}
				for (let r of ["top", "bottom"]) {
					let c = r === "top" ? o : s - a, l = r === "top" ? Math.max(0, c + a + e - n.minY) : Math.min(0, c - e - n.maxB);
					if (n.minY + l < o - 24 || n.maxB + l > s + 24) continue;
					let u = m + i / 2, d = c + a / 2, h = 0;
					for (let [e, t] of f) {
						let r = A.get(e);
						if (!r) continue;
						let i = n.items.includes(r) ? r.y + l : r.y;
						h += t * (Math.abs(u - (r.x + r.block.width / 2)) + Math.abs(d - (i + r.block.height / 2)));
					}
					r === "bottom" && (h += 60), h += t === 0 ? (g - p) * 180 : (p - g) * 180, (!_ || h < _.score) && (_ = {
						colIdx: t,
						side: r,
						auxX: m,
						auxY: c,
						colShiftY: l,
						score: h
					});
				}
			}
			if (_) {
				let e = u[_.colIdx];
				if (e && _.colShiftY !== 0) for (let t of e.items) t.y += _.colShiftY;
				let n = _.auxX;
				for (let e of t) e.x = n, e.y = Math.round(_.auxY + (a - e.block.height) / 2), n += e.block.width + c.horizontalClearance;
			}
		}
		ce.push(...t);
		let a = ki(e, ce, r);
		$(a), la({
			doc: e,
			placed: ce,
			links: a,
			flow: r,
			flowCtx: se,
			preserveFlowOverride: !0,
			rowFilter: "multi-node",
			fallback: "score-greedy",
			fallbackTargets: i,
			symmetryGroups: k
		}, 0);
	}
	return [...ce, ...$n(T, ce, c)];
}
function xa(e, t, n, r, i = !1, a = 0, o) {
	let s = e.groups.filter((e) => e.parentId === t), c = e.nodes.filter((e) => e.parentId === t);
	if (s.length === 0) {
		if (i && c.length >= 4) {
			let n = new Set(c.map((e) => e.id));
			if (!r.connections.some((e) => e.from !== e.to && n.has(e.from) && n.has(e.to))) {
				let r = e.groups.find((e) => e.id === t)?.label ?? "", i = Xt({ steps: e.steps.map((e) => ({
					...e,
					animations: e.animations.filter((e) => n.has(e.from) && n.has(e.to)),
					statics: e.statics.filter((e) => n.has(e.from) && n.has(e.to))
				})) }), a = Math.max(0, ...i.values()), o = Math.min(4, Math.ceil(c.length / 2)), s = Math.ceil(c.length / o), l = o * W.width + Math.max(0, o - 1) * 36, u = s * W.height + Math.max(0, s - 1) * (14 + a), d = l + 32, f = Math.max(d, Jt(r)), p = 16 + Math.round((f - d) / 2), m = Yt(r, f) + 16 + a, h = m + u + 16, g = /* @__PURE__ */ new Map();
				c.forEach((e, t) => {
					let n = Math.floor(t / o), r = t % o;
					g.set(e.id, {
						x: p + r * (W.width + 36),
						y: m + n * (W.height + 14 + a),
						width: W.width,
						height: W.height
					});
				});
				let _ = /* @__PURE__ */ new Map([[t, {
					x: 0,
					y: 0,
					width: f,
					height: h
				}]]), { groupsFlipped: v, reflectConst: y } = qn(t, c.map(({ parentId: e, ...t }) => t), [], a, g, _);
				return {
					id: t,
					width: f,
					height: h,
					head: m,
					contentHeight: u,
					loopRoom: a,
					nodeLoopRoom: i,
					flippable: a === 0,
					nodes: g,
					groups: _,
					groupsFlipped: v,
					reflectConst: y
				};
			}
		}
		let a = o?.parentOwners ?? Gn(e), s = o ? {
			...r,
			zoneStage: o.parentScopeFlow.zoneStage,
			auxiliaryZones: o.parentScopeFlow.auxiliaryZones
		} : r, l = Rt(e.groups), u = new Map(a);
		for (let e of c) u.set(e.id, t);
		return Yn(e, t, n, void 0, l, u, s);
	}
	if (s.length === 1 && c.length === 0 && s[0]) return ya(e, t, [{
		block: xa(e, s[0].id, n, r, i, a + 1, o),
		x: 0,
		y: 0,
		flip: 0
	}]);
	let l = pa(e, t), u = bn(new Set(s.map((e) => e.id)), [...s.map((e) => e.id), ...c.map((e) => e.id)].sort(da), l, r), d = ma(e, s, r, u), f = Xt(e), p = {
		parentOwners: l,
		parentScopeFlow: u
	}, m = [...s.map((t) => xa(e, t.id, n, r, u.auxiliaryZones.has(t.id), a + 1, p)), ...c.map((e) => _a(e.id, f))], h = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map();
	for (let e of m) {
		let t = d.get(e.id);
		t !== void 0 && (h.set(t, Math.max(h.get(t) ?? 0, e.width)), g.set(t, Math.min(g.get(t) ?? Infinity, e.width)));
	}
	return ya(e, t, ba(e, m.map((e) => {
		let t = d.get(e.id);
		if (t === void 0) return e;
		let n = h.get(t) ?? e.width;
		return n - (g.get(t) ?? e.width) <= 80 ? ha(e, n) : e;
	}), l, u, r, d, i, a + 1, Ln));
}
function Sa(e, t) {
	let n = V(e.groups)[0];
	if (!n) return t(e);
	let r = X(e), i = Gn(e), a = Xt(e);
	return mr(ba(e, [xa(e, n.id, t, r, !1, 0), ...e.nodes.filter((e) => e.parentId === void 0).map((e) => _a(e.id, a))], i, r, r, /* @__PURE__ */ new Map(), !1, 0, In));
}
// src/layout/zonePlace.ts
var Ca = 80, wa = 44, Ta = 58;
function Ea(e) {
	return e.map((e) => ({
		x: e.x,
		y: e.y,
		flip: e.flip
	}));
}
function Da(e, t) {
	e.forEach((e, n) => {
		let r = t[n];
		r && (e.x = r.x, e.y = r.y, e.flip = r.flip);
	});
}
function Oa(e, t) {
	return e.map((e, n) => {
		let r = t[n] ?? {
			x: e.x,
			y: e.y,
			flip: e.flip
		};
		return {
			block: na(e.block),
			x: r.x,
			y: r.y,
			flip: r.flip
		};
	});
}
var ka = (e, t) => e < t ? -1 : +(e > t);
function Aa(e, t, n = xa) {
	let r = Hn(e), i = U(r), a = X(r, i), { blocks: o, owners: s } = Xn(r, t, void 0, a, n), { connected: c } = Qn(o, a, s), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
	for (let e of a.connections) {
		let t = s.get(e.from) ?? e.from, n = s.get(e.to) ?? e.to, r = a.pairFirstStep.get(q(e.from, e.to)) ?? 0;
		u.set(t, Math.min(u.get(t) ?? r, r)), u.set(n, Math.min(u.get(n) ?? r, r)), e.role !== "static" && (l.set(t, Math.min(l.get(t) ?? r, r)), l.set(n, Math.min(l.get(n) ?? r, r))), e.role === "primary" && t !== n && (d.set(t, (d.get(t) ?? 0) + 1), d.set(n, (d.get(n) ?? 0) + 1));
	}
	let f = [...c].sort((e, t) => {
		let n = +!!a.auxiliaryZones.has(e.id), r = +!!a.auxiliaryZones.has(t.id);
		if (n !== r) return n - r;
		let i = l.get(e.id) ?? u.get(e.id) ?? 0, o = l.get(t.id) ?? u.get(t.id) ?? 0;
		if (i !== o) return i - o;
		let s = a.zoneStage.get(e.id) ?? 0, c = a.zoneStage.get(t.id) ?? 0;
		if (s !== c) return s - c;
		let f = d.get(e.id) ?? 0, p = d.get(t.id) ?? 0;
		return e.nodes.size === t.nodes.size ? f === p ? ka(e.id, t.id) : p - f : t.nodes.size - e.nodes.size;
	}), p = new Set(f.flatMap((e) => [...e.nodes.keys()])), m = Rt(r.groups), h = tr(f, a), g = sr(f, a, s), _ = Zr(a, s, h, g.wrapped, g.wrapped ? g.rowOfBlock : void 0), v = g.rows.flat(), y = g.auxiliary, x = cr(r, f, s, a), S = f.reduce((e, t) => e + t.nodes.size, 0), C = ta(f.length, S, h), w = f.map((e) => ({
		block: e,
		x: 0,
		y: 0,
		flip: 0
	})), T = /* @__PURE__ */ new Map();
	for (let e of i) e.from !== e.to && (b(T, e.from, e.to), b(T, e.to, e.from));
	let E = new Map(f.map((e) => [e.id, ra(e.nodes)])), D = Sn(r).filter(([e, t]) => p.has(e) && p.has(t)), O = C.slackRanks ? oa(r, i, f, a, s, T) : /* @__PURE__ */ new Map(), k = r.groups.some((e) => e.parentId !== void 0);
	return {
		connDoc: r,
		connected: f,
		links: ki(r, w, a),
		flow: a,
		flowCtx: _,
		preserveFlow: h,
		hasNestedGroups: k,
		refineBudget: C,
		grid: g,
		columns: v,
		auxiliary: y,
		start: x,
		nodeParent: Lt(r.nodes),
		owners: s,
		zoneOf: m,
		adj: T,
		docLinks: D,
		baseOrders: E,
		slackMeta: O,
		blockCache: /* @__PURE__ */ new Map()
	};
}
function ja(e) {
	let { columns: t, flow: n, owners: r } = e, i = 0;
	for (let e of t) for (let t of e) {
		let e = n.zoneStage.get(t.id) ?? 0;
		e > i && (i = e);
	}
	let a = (e) => {
		let t = n.zoneStage.get(e) ?? 0, a = 0, o = 0;
		for (let s of n.connections) {
			let c = r.get(s.from) ?? s.from, l = r.get(s.to) ?? s.to;
			if (c === l || c !== e && l !== e) continue;
			let u = c === e ? l : c, d = n.auxiliaryZones.has(u);
			if (d && l === e) continue;
			let f = d ? i + .5 : n.zoneStage.get(u) ?? t;
			if (!d && f === t) continue;
			let p = n.pairFirstStep.get(q(s.from, s.to)) ?? 0, m = d ? (n.hasAnimate ? .04 : .3) / (1 + .5 * p) : s.role === "primary" ? 2 / (1 + .08 * p) : s.role === "return" ? .8 / (1 + .08 * p) : (n.hasAnimate ? .04 : .3) / (1 + .5 * p);
			a += f * m, o += m;
		}
		return o > 0 ? a / o : t;
	}, o = [];
	for (let e of t) {
		if (e.length <= 2) {
			o.push([...e]);
			continue;
		}
		let t = [...e].sort((e, t) => a(e.id) - a(t.id) || ka(e.id, t.id)), n = Math.ceil(t.length / 2);
		o.push(t.slice(0, n), t.slice(n));
	}
	return o;
}
function Ma(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = t.get(r.block.id);
		if (e === void 0) continue;
		let i = n.get(e), a = r.y + r.block.height;
		i ? (i.minY = Math.min(i.minY, r.y), i.maxBot = Math.max(i.maxBot, a)) : n.set(e, {
			minY: r.y,
			maxBot: a
		});
	}
	let r = [...n.entries()].sort((e, t) => e[0] - t[0]);
	for (let e = 1; e < r.length; e++) {
		let t = r[e - 1]?.[1], n = r[e]?.[1];
		if (t && n && t.maxBot + 34 > n.minY) return !1;
	}
	return !0;
}
function Na(e, t) {
	let n = /* @__PURE__ */ new Map();
	if (!t.preserveFlow || t.auxiliaryZones.size === 0) return n;
	let r = Infinity, i = -Infinity;
	for (let n of e) t.auxiliaryZones.has(n.block.id) || (r = Math.min(r, n.y), i = Math.max(i, n.y + n.block.height));
	if (!Number.isFinite(r)) return n;
	for (let a of e) t.auxiliaryZones.has(a.block.id) && (a.y + a.block.height <= r + 1e-6 ? n.set(a.block.id, "above") : a.y >= i - 1e-6 && n.set(a.block.id, "below"));
	return n;
}
function Pa(e, t, n) {
	if (n.size === 0) return !0;
	let r = Infinity, i = -Infinity;
	for (let n of e) t.auxiliaryZones.has(n.block.id) || (r = Math.min(r, n.y), i = Math.max(i, n.y + n.block.height));
	if (!Number.isFinite(r)) return !0;
	for (let t of e) {
		let e = n.get(t.block.id);
		if (e === "above" && t.y + t.block.height > r - 58 || e === "below" && t.y < i + 58) return !1;
	}
	return !0;
}
function Fa(e, t, n, r, i, a) {
	let o = Ea(e);
	a();
	let s = !i || Ma(e, i), c = Pa(e, n, r);
	s && c || (Da(e, o), $(t));
}
function Ia(e, t, n) {
	let r = new Set(n.map((e) => e.id));
	for (let n of e.connections) {
		if (n.role !== "primary") continue;
		let i = t.get(n.from) ?? n.from, a = t.get(n.to) ?? n.to;
		if (r.has(i) && !r.has(a) && (e.pairFirstStep.get(q(n.from, n.to)) ?? 0) > 1) return !0;
	}
	return !1;
}
function La(e, t, n = "bands") {
	let { connDoc: r, connected: i, auxiliary: a, start: o, flow: s, flowCtx: c, owners: l } = e, u = /* @__PURE__ */ new Map(), d = i.map((e) => {
		let t = o.get(e.id) ?? {
			x: 0,
			y: 0
		}, n = {
			block: na(e),
			x: t.x,
			y: t.y,
			flip: 0
		};
		return u.set(e.id, n), n;
	}), f = d.filter((e) => !s.auxiliaryZones.has(e.block.id)), p = /* @__PURE__ */ new Map();
	for (let e of s.connections) {
		let t = l.get(e.from), n = l.get(e.to);
		if (!t || !n || t === n) continue;
		let r = s.pairFirstStep.get(q(e.from, e.to)) ?? 0, i = e.role === "primary" ? 3 / (1 + .08 * r) : e.role === "return" ? .6 / (1 + .08 * r) : (s.hasAnimate ? .06 : .3) / (1 + .35 * r);
		b(p, t, {
			id: n,
			selfNode: e.from,
			otherNode: e.to,
			w: i
		}), b(p, n, {
			id: t,
			selfNode: e.to,
			otherNode: e.from,
			w: i
		});
	}
	let m = (e, t) => {
		let n = e.block.nodes.get(t);
		return e.y + (n ? n.y + 50 : e.block.height / 2);
	}, h = (t ?? e.grid.rows).map((e) => e.map((e) => [...e])), g = /* @__PURE__ */ new Map();
	h.forEach((e, t) => {
		e.forEach((e, n) => {
			for (let r of e) g.set(r.id, {
				ri: t,
				ci: n
			});
		});
	});
	let _ = () => {
		if (!e.grid.wrapped) {
			let e = h[0] ?? [], t = e.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * wa), n = Math.max(0, ...t), r = 0;
			e.forEach((e, i) => {
				let a = Math.max(0, ...e.map((e) => e.width)), o = (n - (t[i] ?? 0)) / 2;
				for (let t of e) {
					let e = u.get(t.id);
					e && (e.x = r + (a - t.width) / 2, e.y = o), o += t.height + wa;
				}
				r += a + Ca;
			});
			return;
		}
		let t = 0;
		for (let e of h) {
			let n = e.map((e) => e.reduce((e, t) => e + t.height, 0) + Math.max(0, e.length - 1) * wa), r = Math.max(0, ...n), i = 0;
			e.forEach((e, a) => {
				let o = Math.max(0, ...e.map((e) => e.width)), s = t + (r - (n[a] ?? 0)) / 2;
				for (let t of e) {
					let e = u.get(t.id);
					e && (e.x = i + (o - t.width) / 2, e.y = s), s += t.height + wa;
				}
				i += o + Ca;
			}), t += r + Ta;
		}
	};
	_();
	for (let e = 0; e < h.length; e++) {
		let t = h[e];
		if (t) for (let n = 0; n < t.length; n++) {
			let r = t[n];
			!r || r.length < 2 || (r.sort((t, r) => {
				let i = (t) => {
					let r = 0, i = 0;
					for (let { id: a, otherNode: o, w: c } of p.get(t) ?? []) {
						let t = g.get(a);
						if (!t || s.auxiliaryZones.has(a) || t.ri > e || t.ri === e && t.ci >= n) continue;
						let l = u.get(a);
						l && (i += m(l, o) * c, r += c);
					}
					return r > 0 ? i / r : Infinity;
				};
				return i(t.id) - i(r.id) || ka(t.id, r.id);
			}), _());
		}
	}
	for (let e = 0; e < 6; e++) {
		let t = e % 2 == 0 ? h.map((e, t) => t) : h.map((e, t) => h.length - 1 - t);
		for (let n of t) {
			let t = h[n];
			if (!t) continue;
			let r = e % 2 == 0 ? t.map((e, t) => t) : t.map((e, n) => t.length - 1 - n);
			for (let e of r) {
				let r = t[e];
				!r || r.length < 2 || (r.sort((t, r) => {
					let i = (t) => {
						let r = 0, i = 0;
						for (let { id: a, otherNode: o, w: c } of p.get(t) ?? []) {
							let t = g.get(a);
							if (t && t.ri === n && t.ci === e || s.auxiliaryZones.has(a)) continue;
							let l = u.get(a);
							l && (i += m(l, o) * c, r += c);
						}
						return r > 0 ? i / r : Infinity;
					};
					return i(t.id) - i(r.id) || ka(t.id, r.id);
				}), _());
			}
		}
	}
	let v = h.flat();
	if (!e.grid.wrapped && e.preserveFlow) {
		let e = /* @__PURE__ */ new Map();
		for (let t of v) for (let n of t) e.set(n.id, t);
		for (let { a: t, b: n, allowed: r } of c.corridors) {
			if (r.size === 0) continue;
			let i = u.get(t), a = u.get(n);
			if (!i || !a) continue;
			let o = Math.min(i.x + i.block.width / 2, a.x + a.block.width / 2), s = Math.max(i.x + i.block.width / 2, a.x + a.block.width / 2), c = [...r].map((e) => u.get(e)).filter((e) => e !== void 0 && e.x + e.block.width / 2 > o && e.x + e.block.width / 2 < s);
			if (c.length === 0) continue;
			let l = f.filter((e) => {
				if (e === i || e === a || r.has(e.block.id)) return !1;
				let t = e.x + e.block.width / 2;
				return t > o && t < s;
			});
			if (l.length === 0) continue;
			let d = Math.min(...c.map((e) => e.y)), p = Math.max(...c.map((e) => e.y + e.block.height)), m = l.filter((e) => e.y + e.block.height <= d + 4), h = l.filter((e) => e.y >= p - 4);
			if (m.length === l.length) {
				let r = Math.max(...m.map((e) => e.y + e.block.height)) + 8;
				(e.get(t)?.length ?? 0) === 1 && i.y < r && (i.y = r), (e.get(n)?.length ?? 0) === 1 && a.y < r && (a.y = r);
			} else if (h.length === l.length) {
				let r = Math.min(...h.map((e) => e.y)) - 8;
				(e.get(t)?.length ?? 0) === 1 && i.y + i.block.height > r && (i.y = r - i.block.height), (e.get(n)?.length ?? 0) === 1 && a.y + a.block.height > r && (a.y = r - a.block.height);
			}
		}
	}
	let y = /* @__PURE__ */ new Map();
	for (let e of v) e.forEach((t, n) => {
		y.set(t.id, e.length <= 1 ? .5 : n / (e.length - 1));
	});
	if (f.length > 0) {
		let t = ki(r, f, s);
		if ($(t), la({
			doc: r,
			placed: f,
			links: t,
			flow: s,
			flowCtx: c,
			rowFilter: "any",
			fallback: "score-greedy"
		}, 0), e.grid.wrapped) {
			let n = e.grid.rowOfBlock;
			Fa(f, t, c, /* @__PURE__ */ new Map(), n, () => {
				Xi(t, f, !1, c, 60);
			});
		} else Xi(t, f, !1, c, 60), Ki(t, f, c), qi(t, f, c), Xi(t, f, !1, c, 60), $i(t, f, 300, c);
	}
	if (a.length > 0) {
		let t = ur(a.map((e) => u.get(e.id)).filter((e) => e !== void 0), f, l, s, {
			auxMode: n,
			cols: v,
			rowFracOf: y,
			sideMode: "stationY",
			clampMaxSource: !0,
			decayStatic: !0
		}), i = ki(r, d, s);
		if ($(i), e.preserveFlow && !e.grid.wrapped) {
			let e = /* @__PURE__ */ new Map();
			for (let t of i) if (t.role === "primary" && !pn({
				from: t.from,
				to: t.to,
				role: t.role
			}, s, l)) {
				let n = e.get(t.source);
				n || (n = [], e.set(t.source, n)), n.push(t);
			}
			let t = Ea(d), n = Ni(i, c), r = [];
			for (let e of i) if (!(e.role !== "primary" || !s.auxiliaryZones.has(e.source.block.id) || s.auxiliaryZones.has(e.target.block.id) || pn({
				from: e.from,
				to: e.to,
				role: e.role
			}, s, l)) && e.ax >= e.bx - 24) {
				for (e.target.x += Math.ceil(e.ax + 24 - e.bx); !Ci(e.target, d, 60);) e.target.x += 60;
				$(i), r.push(e.target);
			}
			if (r.length > 0) {
				let a = 0, o = d.length * i.length + 16;
				for (let t = 0; t < r.length && a < o; t++) {
					let n = r[t];
					if (n) {
						for (let t of e.get(n) ?? []) if (t.ax >= t.bx - 24) {
							for (a++, t.target.x += Math.ceil(t.ax + 24 - t.bx); !Ci(t.target, d, 60);) t.target.x += 60;
							$(i), r.push(t.target);
						}
					}
				}
				(a >= o || Ni(i, c) > n) && (Da(d, t), $(i));
			}
		}
		la({
			doc: r,
			placed: d,
			links: i,
			flow: s,
			flowCtx: c,
			preserveFlowOverride: !0,
			rowFilter: "multi-node",
			fallback: "score-greedy",
			fallbackTargets: t
		}, n === "right-top" ? e.refineBudget.flipBitmaskCap : 0);
	}
	return d;
}
function Ra(e, t, n, r, i) {
	if (!i.preserveFlow || i.corridors.length === 0) return;
	let a = i.wrapped ? i.rowOfBlock : void 0, o = () => {
		let e = new Map(t.map((e) => [e.block.id, {
			x: e.x,
			y: e.y,
			width: e.block.width,
			height: e.block.height
		}]));
		return _n(i.corridors, e, a);
	}, s = o();
	if (s !== 0) for (let c = 0; c < 3 && s > 0; c++) {
		let c = !1, l = new Map(t.map((e) => [e.block.id, e]));
		for (let u of i.corridors) {
			let d = a?.get(u.a), f = a?.get(u.b);
			if (d !== void 0 && f !== void 0 && d !== f) continue;
			let p = l.get(u.a), m = l.get(u.b);
			if (!p || !m) continue;
			let h = p.x + p.block.width / 2, g = m.x + m.block.width / 2, _ = Math.min(h, g), v = Math.max(h, g), y = Math.min(p.y, m.y), b = Math.max(p.y + p.block.height, m.y + m.block.height);
			for (let l of t) {
				if (l === p || l === m || u.allowed.has(l.block.id)) continue;
				if (a) {
					let e = a.get(l.block.id);
					if (e !== void 0 && (d !== void 0 && e !== d || f !== void 0 && e !== f)) continue;
				}
				let h = l.x + l.block.width / 2;
				if (!(h > _ && h < v && l.y < b && l.y + l.block.height > y)) continue;
				let g = l.x, x = l.y;
				$(n);
				let S = Ni(n, i), C = Pi(e, t, n, r, i, {
					mode: "intrusion",
					intrusions: s
				}), w = v - l.block.width / 2 + 2, T = [
					{
						x: w,
						y: x
					},
					{
						x: g,
						y: y - 35 - l.block.height
					},
					{
						x: g,
						y: b + 35
					},
					{
						x: w,
						y: y - 35 - l.block.height
					}
				];
				for (let e of t) {
					if (e === l) continue;
					let t = e.x + e.block.width + 61, n = e.x - 61 - l.block.width;
					T.push({
						x: Math.max(w, e.x),
						y: e.y - 35 - l.block.height
					}, {
						x: Math.max(w, e.x),
						y: e.y + e.block.height + 35
					}, {
						x: t,
						y: x
					}, {
						x: t,
						y: e.y
					}, {
						x: t,
						y: e.y - 35 - l.block.height
					}, {
						x: Math.max(w, t),
						y: e.y - 35 - l.block.height
					}, {
						x: t,
						y: y - 4 - l.block.height
					}, {
						x: t,
						y: b + 4
					}, {
						x: n,
						y: y - 4 - l.block.height
					});
				}
				let E;
				for (let a of T) {
					if (l.x = a.x, l.y = a.y, !Ci(l, t) || ($(n), Ni(n, i) > S)) continue;
					let c = o();
					if (c >= s) continue;
					let u = Pi(e, t, n, r, i, {
						mode: "intrusion",
						intrusions: c
					});
					u < C && (!E || u < E.cost) && (E = {
						x: a.x,
						y: a.y,
						cost: u,
						intCount: c
					});
				}
				E ? (l.x = E.x, l.y = E.y, s = E.intCount, $(n), c = !0) : (l.x = g, l.y = x, $(n));
			}
		}
		if (!c) break;
	}
}
function za(e, t, n = xa) {
	let r = Aa(e, t, n);
	if (r.connected.length === 0) return /* @__PURE__ */ new Map();
	let { connDoc: i, connected: a, flow: o, flowCtx: s, hasNestedGroups: c, refineBudget: l, nodeParent: u, owners: d, zoneOf: f, adj: p, docLinks: m, baseOrders: h, slackMeta: g, blockCache: _ } = r, v = new Uint8Array(a.length);
	s.preserveFlow && r.grid.rows[0]?.[0]?.length === 1 && a.forEach((e, t) => {
		e.flippable && ia(e) && !o.auxiliaryZones.has(e.id) && (o.zoneStage.get(e.id) ?? 0) === 0 && (v[t] = 1);
	});
	let y = !r.grid.wrapped && r.auxiliary.length > 0 && Ia(o, d, r.auxiliary), b = [], x = La(r, r.grid.rows, "bands"), S = Ea(x);
	b.push({
		poses: S,
		auxMode: "bands"
	});
	let C = (e, t) => e.some((e, n) => Math.abs(e.x - (t[n]?.x ?? 0)) > 1 || Math.abs(e.y - (t[n]?.y ?? 0)) > 1 || e.flip !== (t[n]?.flip ?? 0));
	if (y) {
		let e = Ea(La(r, r.grid.rows, "right-top"));
		C(e, S) && b.push({
			poses: e,
			auxMode: "right-top"
		});
	}
	if (!r.grid.wrapped && r.grid.rows[0]?.some((e) => e.length >= 3)) {
		let e = _i(x);
		if (e.width / Math.max(1, e.height) < 1.35) {
			let e = ja(r), t = Ea(La(r, [e], "bands"));
			if (b.push({
				poses: t,
				auxMode: "bands"
			}), y) {
				let n = Ea(La(r, [e], "right-top"));
				C(n, t) && b.push({
					poses: n,
					auxMode: "right-top"
				});
			}
		}
	}
	let w = r.grid.wrapped || r.auxiliary.length > 0 ? [{
		aside: !1,
		breathe: !1
	}] : !c && a.length <= 10 ? [
		{
			aside: !1,
			breathe: !1
		},
		{
			aside: !0,
			breathe: !1
		},
		{
			aside: !1,
			breathe: !0
		},
		{
			aside: !0,
			breathe: !0
		}
	] : [{
		aside: !1,
		breathe: !1
	}, {
		aside: !0,
		breathe: !1
	}], T = a.every((e) => e.flippable), E = r.auxiliary.length > 0 ? 0 : -1, D = Infinity, O = /* @__PURE__ */ new Map();
	for (let { poses: e, auxMode: n } of b) for (let { aside: a, breathe: y } of w) {
		let b = Oa(x, e), S = new Map(h), C = ki(i, b, o);
		$(C);
		let w = n === "bands" ? Na(b, s) : /* @__PURE__ */ new Map(), k = r.grid.wrapped ? r.grid.rowOfBlock : void 0, A = /* @__PURE__ */ new Map();
		if (r.grid.wrapped) Fa(b, C, s, w, k, () => {
			Xi(C, b, !1, s, 60);
		}), la({
			doc: i,
			placed: b,
			links: C,
			flow: o,
			flowCtx: s,
			fallback: "score-greedy"
		}, l.flipBitmaskCap, v), ca(b, u, d, p, m, l, o) && (C = ki(i, b, o), $(C)), Fa(b, C, s, w, k, () => {
			$i(C, b, 120, s, 60);
		});
		else {
			if (Fa(b, C, s, w, void 0, () => {
				Xi(C, b, a, s, 60), Ki(C, b, s, 60), qi(C, b, s, 60), Xi(C, b, a, s, 60);
			}), A = sa(i, t, b, d, f, u, p, S, g, _, o, s, l), A.size > 0 && (C = ki(i, b, o), $(C), Fa(b, C, s, w, void 0, () => {
				qi(C, b, s, 60);
			})), s.preserveFlow && s.corridors.length > 0 && Fa(b, C, s, w, void 0, () => {
				Ra(i, b, C, o, s);
			}), la({
				doc: i,
				placed: b,
				links: C,
				flow: o,
				flowCtx: s,
				preserveFlowOverride: !0,
				fallback: "score-greedy"
			}, l.flipBitmaskCap, v) && r.auxiliary.length > 0 && n === "bands") {
				let e = b.filter((e) => !o.auxiliaryZones.has(e.block.id));
				ur(b.filter((e) => o.auxiliaryZones.has(e.block.id)), e, d, o, {
					auxMode: "bands",
					cols: r.grid.rows.flat(),
					sideMode: "stationY",
					clampMaxSource: !0,
					decayStatic: !0
				}), w.clear();
				for (let [e, t] of Na(b, s)) w.set(e, t);
				$(C);
			}
			!c && l.slackRanks && la({
				doc: i,
				placed: b,
				links: C,
				flow: o,
				flowCtx: s,
				flippability: "unflippable",
				fallback: "score-greedy"
			}, 0), ca(b, u, d, p, m, l, o) && (C = ki(i, b, o), $(C)), ua(b, C, m, o, s, l, 60, n === "bands"), ca(b, u, d, p, m, l, o) && (C = ki(i, b, o), $(C)), y && (Zi(b, s), $(C)), Fa(b, C, s, w, void 0, () => {
				$i(C, b, 120, s, 60);
			});
		}
		let j = mr(b), M = Zt([...Object.values(j.nodes), ...Object.values(j.groups)]), N = M.width / Math.max(1, M.height), P = Pi(i, b, C, o, s, {
			mode: "full",
			layout: j,
			columnsCount: r.columns.length,
			hasNestedGroups: c,
			allFlippable: T,
			firstAuxIdx: E,
			entryMask: v
		});
		if (P < D) {
			let e = Ea(b);
			if (Fa(b, C, s, w, k, () => {
				$i(C, b, 300, s, 60);
			}), !r.grid.wrapped && (c && Fa(b, C, s, w, void 0, () => {
				ea(C, b, 900, s, 60);
			}), y && E < 0 ? (Zi(b, s), $(C)) : !y && s.preserveFlow && E < 0 && !c && N > 1.5 && (Zi(b, s, 86, !0), $(C)), s.preserveFlow)) {
				let t = mr(b), n = Zt([...Object.values(t.nodes), ...Object.values(t.groups)]), r = n.width / Math.max(1, n.height);
				(r < 1.08 && N >= 1.08 || y && E < 0 && r < 1.78 && N >= 1.78) && (Da(b, e), $(C));
			}
			D = P, O = aa(b, S, A);
		}
	}
	return O;
}
// src/layout/index.ts
function Ba(e) {
	if (!Rn(e)) return fn(e, Ar(e, (e) => fa(e) ? Sa(e, jr) : jr(e)));
	let t = Ha(e);
	return fn(e, Sr(e, t ? pr(e, t, jr, xa) : jr(e)));
}
function Va(e) {
	return Rn(e);
}
function Ha(e) {
	if (!Rn(e)) return;
	let t = qa(e);
	return t && Ja(t.key, Ya(t.doc)), Ka?.placement;
}
function Ua(e, t, n) {
	if (t === n) return [t];
	let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set([t]), a = [t];
	for (let t = 0; t < a.length; t++) {
		let o = a[t];
		if (o !== void 0) {
			for (let t of e.get(o) ?? []) if (!i.has(t)) {
				if (i.add(t), r.set(t, o), t === n) {
					let e = [n];
					for (let t = r.get(n); t !== void 0; t = r.get(t)) e.push(t);
					return e.reverse(), e;
				}
				a.push(t);
			}
		}
	}
}
function Wa(e, t, n, r, i, a) {
	let o = An(e, t), s = new Set(e), c = (e) => r?.[e] ?? o.rank.get(e) ?? 0, l = new Set(o.back.map((e) => q(e.from, e.to))), u = new Set(o.back.map((e) => `${e.from}\0${e.to}`)), d = new Map(e.map((e) => [e, []])), f = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Set();
	for (let [e, n] of t) {
		if (e === n || !s.has(e) || !s.has(n)) continue;
		let t = q(e, n);
		f.has(t) || f.set(t, [e, n]), !u.has(`${e}\0${n}`) && c(e) < c(n) && (d.get(e)?.push(n), p.set(t, [e, n]), m.add(`${e}\0${n}`));
	}
	let h, g = (t) => {
		if (!h) {
			h = /* @__PURE__ */ new Map();
			for (let t of e) {
				if (h.has(t)) continue;
				h.set(t, t);
				let e = [t];
				for (let n = 0; n < e.length; n++) {
					let r = e[n];
					if (r !== void 0) for (let n of d.get(r) ?? []) h.has(n) || (h.set(n, t), e.push(n));
				}
			}
		}
		return h.get(t) ?? t;
	}, _, v = () => {
		if (!_) {
			_ = /* @__PURE__ */ new Map();
			for (let [e, t] of a ?? []) {
				if (e === t) continue;
				let n = _.get(e);
				n ? n.push(t) : _.set(e, [t]);
			}
		}
		return _;
	}, y = [...o.back], b = new Set(l), x = new Set(u);
	for (let e of n) {
		if (e.from === e.to || !s.has(e.from) || !s.has(e.to)) continue;
		let t = q(e.from, e.to);
		if (b.has(t) || p.has(t)) continue;
		let [n, r] = f.get(t) ?? [e.from, e.to], i = Ua(d, r, n);
		if (i) b.add(t), x.add(`${n}\0${r}`), y.push({
			from: n,
			to: r,
			loop: i,
			root: g(r)
		});
		else if ((e.role !== "static" || f.has(t)) && c(n) >= c(r)) {
			let e = a ? Ua(v(), r, n) : void 0;
			e && e.length >= 2 && (b.add(t), x.add(`${n}\0${r}`), y.push({
				from: n,
				to: r,
				loop: e,
				root: g(r)
			}));
		}
	}
	if (i) for (let [e, t] of i) {
		let n = `${e}\0${t}`;
		if (e === t || !s.has(e) || !s.has(t) || x.has(n) || m.has(n)) continue;
		let r = Ua(d, t, e);
		r && r.length >= 2 && (x.add(n), y.push({
			from: e,
			to: t,
			loop: r,
			root: g(t)
		}));
	}
	return y;
}
function Ga(e) {
	let t = e.nodes.map((e) => e.id), n = U(e), r = [];
	for (let t of e.steps) {
		for (let e of t.animations) e.direction === "forward" && e.from !== e.to && r.push([e.from, e.to]);
		for (let e of t.statics) e.direction === "forward" && e.from !== e.to && r.push([e.from, e.to]);
	}
	if (!Rn(e)) {
		let i = X(e, n);
		return Wa(t, i.forwardEdges, i.connections, void 0, r);
	}
	let i = Ha(e), a = Gn(e), o = Hn(e), s = o === e ? null : new Set(V(o.groups).map((e) => e.id)), c = X(e, n), l = o === e ? c : X(o);
	return V(e.groups).flatMap((e) => {
		let o = t.filter((t) => a.get(t) === e.id), u = new Set(o), d = n.filter((e) => u.has(e.from) && u.has(e.to)), f = s === null || s.has(e.id) ? l : c, p = Jn(u, d, f, a), m = r.filter(([e, t]) => u.has(e) && u.has(t));
		return Wa(o, p.forwardEdges, p.connections, i?.get(e.id)?.ranks, m, f.forwardEdges);
	});
}
var Ka;
function qa(e) {
	if (!Rn(e)) return;
	let t = Vn(e);
	if (Ka?.key === t) return;
	let n = Un(e);
	return {
		key: t,
		doc: n,
		links: Kn(n)
	};
}
function Ja(e, t) {
	Ka = {
		key: e,
		placement: t
	};
}
function Ya(e) {
	return Rn(e) ? za(e, jr, xa) : void 0;
}
// src/skill/lines.ts
var Xa = (e) => e.replace(/\p{Cc}+/gu, (e) => /^\t+$/.test(e) ? e : " "), Za = (e) => e.direction === "bidirectional" ? e.style === "dashed" ? "<.>" : "<->" : e.style === "dashed" ? "..>" : "-->", Qa = 1, $a = (e, t) => `${e} ${t}${e === 1 ? "" : "s"}`;
function eo(e, t) {
	let n = [...new Set(e)].sort((e, t) => e - t), [r = 0] = n, i = n[n.length - 1] ?? r;
	return n.length === 1 ? `${t} ${r}` : i - r + 1 === n.length ? `${t}s ${r} to ${i}` : `${t}s ${n.slice(0, -1).join(", ")} and ${i}`;
}
function to(e) {
	return [...new Set(e.map(Math.round))].sort((e, t) => e - t);
}
function no(e, t, n, r, i) {
	if (e.length === 0 || t.length === 0) return "";
	let a = e.flatMap((e) => n[t.indexOf(e)] ?? []);
	if (a.length === e.length) return `, ${i} its ${eo(a, r)}`;
	let [o] = e, s = o === void 0 || e.length > 1 ? -1 : t.findIndex((e) => e > o);
	return s > 0 ? `, between its ${r}s ${n[s - 1]} and ${n[s]}` : "";
}
var ro = (e, t) => e.length === 1 && t.length === 1 && e[0] === t[0], io = (e, t, n, r) => Math.min(e + t, n + r) - Math.max(e, n) >= Math.min(t, r) / 2, ao = (e, t) => io(e.y, e.height, t.y, t.height), oo = (e, t) => io(e.x, e.width, t.x, t.width);
function so(e, t) {
	let { rect: n } = e, r = t.filter((t) => t !== e), i = (e, t) => [...e].sort((e, n) => t(e.rect) - t(n.rect))[0], a = r.filter((e) => ao(n, e.rect)), o = r.filter((e) => oo(n, e.rect)), s = i(a.filter((e) => e.rect.x + e.rect.width <= n.x + Qa), (e) => n.x - (e.x + e.width)), c = i(a.filter((e) => e.rect.x >= n.x + n.width - Qa), (e) => e.x - (n.x + n.width)), l = i(o.filter((e) => e.rect.y + e.rect.height <= n.y + Qa), (e) => n.y - (e.y + e.height)), u = i(o.filter((e) => e.rect.y >= n.y + n.height - Qa), (e) => e.y - (n.y + n.height)), d = (t, n) => t.grid ? `${n} ${t.name}${no(e.ys, t.grid.ys, t.grid.rows, "row", "level with")}` : `${n} ${t.name}${ro(e.ys, t.ys) ? ", level" : ""}`, f = (t, n, r) => t.grid ? `${n} ${t.name}${no(e.xs, t.grid.xs, t.grid.columns, "column", r)}` : `${ro(e.xs, t.xs) ? "straight " : ""}${n} ${t.name}`, p = [
		s && d(s, "right of"),
		c && d(c, "left of"),
		l && f(l, "below", "under"),
		u && f(u, "above", "over")
	].filter((e) => !!e);
	if (p.length > 0) return p.join("; ");
	let m = (e) => ({
		x: e.x + e.width / 2,
		y: e.y + e.height / 2
	}), h = m(n), g = i(r, (e) => Math.hypot(m(e).x - h.x, m(e).y - h.y));
	if (!g) return "";
	let _ = m(g.rect);
	return `${h.y < _.y ? "above" : "below"} and ${h.x < _.x ? "left" : "right"} of ${g.name}`;
}
function co(e, t, n) {
	let r = e.flatMap((e) => {
		let n = t[e.id];
		return n ? [{
			node: e,
			x: Math.round(n.x),
			y: Math.round(n.y)
		}] : [];
	}), i = to(r.map((e) => e.x)), a = to(r.map((e) => e.y)), o = i.map((e) => n.xs.indexOf(e) + 1), s = a.map((e) => n.ys.indexOf(e) + 1), c = new Map(r.map((e) => [e.node.id, o[i.indexOf(e.x)] ?? 0])), l = new Map(r.map((e) => [e.node.id, s[a.indexOf(e.y)] ?? 0])), u = a.map((e) => i.map((t) => {
		let n = r.find((n) => n.x === t && n.y === e);
		return n ? `${n.node.id}${n.node.visible ? "" : " (hidden)"}` : "-";
	})), d = [["column", ...o.map(String)], ...u.map((e, t) => [`row ${s[t]}`, ...e])], f = d[0]?.map((e, t) => Math.max(...d.map((e) => e[t]?.length ?? 0))), p = d.map((e) => e.map((e, t) => e.padEnd(f?.[t] ?? 0)).join(" | ").trimEnd());
	return {
		size: `${$a(i.length, "column")} x ${$a(a.length, "row")}`,
		lines: p,
		xs: i,
		ys: a,
		columns: o,
		rows: s,
		columnOf: c,
		rowOf: l
	};
}
function lo(e) {
	if (e.nodes.length === 0) return [];
	let t = Ba(e), n = [], r = V(e.groups), i = (e) => `"${e.label || e.id}"`, a = e.nodes.flatMap((e) => t.nodes[e.id] ?? []), o = {
		xs: to(a.map((e) => e.x)),
		ys: to(a.map((e) => e.y))
	};
	if (r.length === 0) {
		let r = co(e.nodes, t.nodes, o);
		n.push(`no zones, ${r.size}`, ...r.lines.map((e) => `  ${e}`));
	} else {
		n.push(`${$a(o.xs.length, "column")} x ${$a(o.ys.length, "row")} in all, numbered from the left and from the top across the whole diagram`);
		let a = Lt(e.groups), s = (t) => e.nodes.filter((e) => Bt(a, e.parentId).includes(t)), c = [...r.flatMap((e) => {
			let n = t.groups[e.id];
			if (!n) return [];
			let r = s(e.id), a = r.length > 0 ? co(r, t.nodes, o) : void 0;
			return [{
				title: `zone ${i(e)} (${e.id})`,
				name: i(e),
				rect: n,
				zone: e,
				grid: a,
				xs: a?.xs ?? [],
				ys: a?.ys ?? []
			}];
		}), ...e.nodes.filter((e) => e.parentId === void 0).flatMap((e) => {
			let n = t.nodes[e.id];
			if (!n) return [];
			let [r, i] = [Math.round(n.x), Math.round(n.y)];
			return [{
				title: `node ${e.id}, outside every zone, column ${o.xs.indexOf(r) + 1}, row ${o.ys.indexOf(i) + 1}`,
				name: e.id,
				rect: n,
				xs: [r],
				ys: [i]
			}];
		})].sort((e, t) => e.rect.x - t.rect.x || e.rect.y - t.rect.y);
		for (let e of c) {
			let t = so(e, c);
			n.push(`${e.title}${e.grid ? `, ${e.grid.size}` : ""}${t ? `: ${t}` : ""}`);
		}
		for (let t of c) {
			let { grid: r } = t;
			if (t.zone && r) {
				n.push(`nodes of ${t.name} (${t.zone.id}):`), n.push(...r.lines.map((e) => `  ${e}`));
				for (let o of e.groups) {
					if (o.id === t.zone.id || !Bt(a, o.id).includes(t.zone.id)) continue;
					let c = s(o.id).flatMap((e) => r.columnOf.get(e.id) ?? []), l = s(o.id).flatMap((e) => r.rowOf.get(e.id) ?? []);
					if (c.length === 0) continue;
					let u = e.groups.find((e) => e.id === o.parentId), d = u && u.id !== t.zone.id ? i(u) : "it";
					n.push(`  inside ${d}, zone ${i(o)} (${o.id}): ${eo(c, "column")}, ${eo(l, "row")}`);
				}
			}
		}
	}
	let s = zt(e), c = (t) => {
		let n = e.groups.find((e) => e.id === s.get(t));
		return n ? i(n) : void 0;
	};
	for (let r of U(e)) {
		let [e] = Cn([[r.from, r.to]], t);
		if (r.from === r.to || !e) continue;
		let i = Math.round(e.bx - e.ax), a = Math.round(e.by - e.ay), o = i > 0 ? "right" : "left", s = Math.abs(a) < Qa ? `${o}, level` : Math.abs(i) < Qa ? `straight ${a > 0 ? "down" : "up"}` : `${a > 0 ? "down" : "up"} and ${o}`, [l, u] = [c(r.from), c(r.to)], d = l === u ? "" : l && u ? `, from ${l} into ${u}` : u ? `, into ${u}` : `, out of ${l}`;
		n.push(`${r.from} ${Za(r)} ${r.to}: ${s}${d}`);
	}
	return n;
}
// src/skill/layoutReport.ts
var uo = 4, fo = 1.5, po = 3, mo = 5, ho = 10, go = (e) => new Set(e.map(Math.round)).size, _o = (e) => go(e.map((e) => e.x)), vo = (e) => go(e.map((e) => e.y)), yo = (e) => `${_o(e)} x ${vo(e)}`, bo = (e, t) => e >= t ? `${(e / t).toFixed(1)} : 1` : `1 : ${(t / e).toFixed(1)}`;
function xo(e, t) {
	let n = zt(e), r = V(e.groups), i = new Map([...r.map((e, t) => [e.id, t]), ...e.nodes.map((e, t) => [e.id, r.length + t])]), a = (e) => i.get(e) ?? 0, o = new Map(r.map((e) => [e.id, `"${e.label || e.id}"`])), s = (e) => o.get(e) ?? e, c = (e) => {
		let [t = "", r = ""] = [n.get(e.from) ?? e.from, n.get(e.to) ?? e.to].sort((e, t) => a(e) - a(t));
		return {
			key: H(t, r),
			rank: [a(t), a(r)],
			text: t === r ? s(t) : `${s(t)}–${s(r)}`
		};
	}, l = /* @__PURE__ */ new Map();
	for (let [e, n] of t) {
		let [t, r] = [c(e), c(n)].sort((e, t) => e.rank[0] - t.rank[0] || e.rank[1] - t.rank[1]);
		if (!t || !r) continue;
		let i = H(t.key, r.key), a = l.get(i);
		a ? a.count++ : l.set(i, {
			zones: `${t.text} × ${r.text}`,
			count: 1
		});
	}
	return [...l.values()].sort((e, t) => t.count - e.count);
}
function So(e, t) {
	let n = zt(e), r = new Map(e.groups.map((e) => [e.id, `"${e.label || e.id}"`])), i = (e) => {
		let t = n.get(e);
		return t === void 0 ? void 0 : r.get(t);
	};
	return U(e).flatMap((e) => {
		if (e.from === e.to || (n.get(e.from) ?? e.from) === (n.get(e.to) ?? e.to)) return [];
		let [r] = Cn([[e.from, e.to]], t);
		if (!r || Math.round(r.bx - r.ax) > -1) return [];
		let [a, o] = [i(e.from), i(e.to)], s = a && o ? `, from ${a} into ${o}` : o ? `, into ${o}` : a ? `, out of ${a}` : "";
		return [`${e.from} ${Za(e)} ${e.to}${s}`];
	});
}
function Co(e, t) {
	return e.loop.length > 2 || (t.get(e.to) ?? 0) > (t.get(e.from) ?? 0);
}
function wo(e, t, n) {
	let r = e.find((e) => e.from === t.from && e.to === t.to || e.from === t.to && e.to === t.from), i = r ? Za(r) : "-->", a = t.root === t.to ? `${t.to}, the node of it declared first` : `${t.to}, from ${t.root}`;
	return `${t.from} ${i} ${t.to} points back, so it does not count for the columns: it closes the loop ${t.loop.join(" → ")}. The layout came into the loop at ${a}, and set it out from left to right in that order: ${t.from} stands at its far end, in column ${n(t.from)}, with ${t.to} in column ${n(t.to)}.`;
}
function To(e) {
	if (e.nodes.length === 0) return {
		summary: [],
		notes: []
	};
	let t = Ba(e), n = U(e), r = (e) => {
		let n = t.nodes[e];
		return n ? [n] : [];
	}, i = e.nodes.flatMap((e) => r(e.id)), a = Zt([...i, ...Object.values(t.groups)]), o = Math.round(a.width), s = Math.round(a.height), c = Cn(Sn(e), t), l = c.flatMap((e, t) => c.slice(t + 1).filter((t) => !Tn(e, t) && En(e, t)).map((t) => [e, t])), u = (e) => {
		let t = n.find((t) => t.from === e.from && t.to === e.to);
		return `${e.from} ${t ? Za(t) : "-->"} ${e.to}`;
	}, d = l.map(([e, t]) => `${u(e)} and ${u(t)}`), f = d.length, p = [`layout: ${o} x ${s} (${bo(o, s)}), ${_o(i)} columns x ${vo(i)} rows of nodes, ${f} ${f === 1 ? "crossing" : "crossings"}`], m = Lt(e.groups), h = (t) => e.nodes.filter((e) => Bt(m, e.parentId).includes(t)), g = V(e.groups).map((e) => ({
		g: e,
		rects: h(e.id).flatMap((e) => r(e.id))
	})).filter(({ rects: e }) => e.length > 0), _ = g.length > 0 && Va(e);
	if (g.length > 0 && p.push(`layout: zones ${_ ? "placed freely" : "in shared columns"}, as columns x rows of nodes: ${g.map(({ g: e, rects: t }) => `"${e.label || e.id}" ${yo(t)}`).join(", ")}`), g.length > 0 && f > 0) {
		let t = xo(e, l), n = t.slice(ho), r = n.reduce((e, { count: t }) => e + t, 0), i = `${t.slice(0, ho).map(({ zones: e, count: t }) => `${e} ${t}`).join(", ")}${n.length > 0 ? `, and ${r} more in ${n.length} other pairs` : ""}`;
		p.push(`layout: crossings by the zones the two connections join, "A" for one inside a zone and "A"–"B" for one between two: ${i}`);
	}
	let v = [];
	s > o * fo && v.push({
		code: "tall-diagram",
		message: `The diagram is ${(s / o).toFixed(1)} times as tall as it is wide. Nodes that no edge puts in order are stacked in one column: where one of them really feeds another, declare that edge, and it moves to the right.`
	});
	for (let t of e.groups) {
		let n = e.nodes.filter((e) => e.parentId === t.id).flatMap((e) => r(e.id));
		n.length >= uo && _o(n) === 1 && v.push({
			code: "stacked-zone",
			message: `Zone "${t.label || t.id}" stacks its ${n.length} nodes in one column, because no edge runs between them. That is right for peers, such as replicas, separate stores, outside services or people, and the note can then be left. If one of them feeds another, declare that edge, and they spread to the right.`
		});
	}
	let y = [...new Set(i.map((e) => Math.round(e.x)))].sort((e, t) => e - t), b = (e) => y.indexOf(Math.round(t.nodes[e]?.x ?? NaN)) + 1, x = new Map(e.nodes.map((e, t) => [e.id, t])), S = /* @__PURE__ */ new Set();
	for (let t of Ga(e)) {
		let e = H(t.from, t.to);
		!S.has(e) && Co(t, x) && (S.add(e), v.push({
			code: "back-edge",
			message: wo(n, t, b)
		}));
	}
	let C = _ ? So(e, t) : [];
	if (C.length > 0) {
		let e = C.length;
		v.push({
			code: "left-links",
			message: `${e === 1 ? "One connection between zones points" : `${e} connections between zones point`} left, against the reading direction: ${C.slice(0, mo).join("; ")}${e > mo ? "; and more" : ""}. The zones are placed freely, and a link between zones sets no column, whichever way it is written. Leave a link whose edge is written as you mean: pointing left is the price of shorter links that cross less. Change only an edge written other than you mean, such as a call back written one way, which becomes one two-way edge that names the node on the left first. Nesting two zones in one zone that is a real boundary makes the links between them point right, since edges set the columns inside a zone, though crossings can rise.`
		});
	}
	return f > 0 && v.push({
		code: "crossings",
		message: `${f === 1 ? "One pair of connections crosses" : `${f} pairs of connections cross`}, counted on straight lines between the nodes: ${d.slice(0, po).join("; ")}${f > po ? "; and more" : ""}. Swapping the declarations of two nodes that share a column often removes a crossing. In a large diagram, leave the rest once the zones stand in the order you mean.`
	}), {
		summary: p,
		notes: v
	};
}
var Eo = (e) => e === " " || e === "\n" || p(e) || e === "—" || e === "→" || e === "←" || e === "↔" || e === "・";
function Do(e) {
	if (e >= "ぁ" && e <= "ゟ") return "hiragana";
	if (e >= "ァ" && e <= "ヿ" && e !== "・") return "katakana";
	if (e >= "一" && e <= "鿿" || e >= "㐀" && e <= "䶿" || e === "々") return "kanji";
}
var Oo = /* @__PURE__ */ new Set([..."をにへがはのとでもやか"]), ko = 12, Ao = /^[([{（「『【〈《〔]+$/, jo = /^(.+?)([([{（「『【〈《〔]+)$/, Mo = /^[)\]}）」』】〉》〕。、，．・：；！？…‥ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]+/, No = (e) => e === " " || e === "\n";
function Po(e) {
	let t = e.flatMap((t, n) => {
		let r = e[n + 1];
		if (r !== void 0 && !No(r) && !Ao.test(t)) {
			let e = jo.exec(t);
			if (e?.[1] && e[2]) return [e[1], e[2]];
		}
		return [t];
	}), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		t !== void 0 && !No(t) && !No(e) && Mo.test(e) ? n[n.length - 1] = t + e : n.push(e);
	}
	let r = [], i = "";
	for (let e of n) Ao.test(e) ? i += e : i ? (No(e) ? r.push(i, e) : r.push(i + e), i = "") : r.push(e);
	return i && r.push(i), r;
}
function Fo(e, t, n, r = "normal", i = d) {
	if (i(e, t, r) <= n) return e;
	let a = "";
	for (let o of e) {
		if (i(`${a + o}…`, t, r) > n) break;
		a += o;
	}
	return `${r === "mono" ? a : a.trimEnd()}…`;
}
function Io(e, t, n, r = 3, i = "normal", a = d) {
	let o = e.trim().replace(/\s*\n\s*/g, "\n").replace(/[^\S\n]+/g, " ");
	if (!o) return [];
	let s = [], c = "", l, u = 0, f = 0, p = "", m = () => {
		c && s.push(c), c = "", u = 0;
	};
	for (let e of o) {
		let r = Do(e);
		if (r) {
			let o = r === "kanji" && l === "hiragana" && f === 1 && !Oo.has(p);
			(l === "other" || u >= ko || a(c + e, t, i) > n || r === "kanji" && l !== "kanji" && !o || r === "katakana" && l !== "katakana") && m(), c += e, u++, f = r === "hiragana" ? l === "hiragana" ? f + 1 : l === "kanji" ? 1 : 2 : 0, p = e, l = r;
		} else Eo(e) ? (m(), s.push(e), l = void 0) : (l !== "other" && m(), c += e, l = "other");
	}
	m();
	let h = Po(s), g = [], _ = "";
	for (let e = 0; e < h.length; e++) {
		let o = h[e] ?? "";
		if (!_ && o === " ") continue;
		let s = _ + o;
		if (o === "\n" || _ && a(s, t, i) > n) {
			if (g.length + 1 >= r) {
				let r = (_ + h.slice(e).join("")).trim().replace(/\n/g, " ");
				return g.push(Fo(r, t, n, i, a)), g;
			}
			g.push(Fo(_.trimEnd(), t, n, i, a)), _ = o === " " || o === "\n" ? "" : o;
		} else _ = s;
	}
	return _.trim() && g.push(Fo(_.trim(), t, n, i, a)), g;
}
function Lo(e, t, n, r, i = "normal", a = d) {
	let o = e.trim().replace(/\s*\n\s*/g, "\n").replace(/[^\S\n]+/g, " ");
	if (!o) return !1;
	if (r <= 1 && !o.includes("\n")) return Fo(o, t, n, i, a) !== o;
	if (!o.includes("\n") && a(o, t, i) <= n) return !1;
	let s = Io(o, t, n, r, i, a).join(""), c = o.replace(/\s+/g, "");
	return s.replace(/\s+/g, "") !== c;
}
// src/scene/calloutMeasure.ts
var Ro = d, zo = 14, Bo = 16, Vo = 414, Ho = 180, Uo = 2, Wo = 4, Go = 4, Ko = 202, qo = {
	withLabel: 54,
	bare: 26
}, Jo = 18, Yo = 15, Xo = 12.5, Zo = 440, Qo = 15;
function $o(e) {
	let t = v(e.body, { stripAllOuterBlankLines: !0 });
	if (!t) return;
	let n = t.split("\n"), r = (n.length > 10 ? [...n.slice(0, 9), "…"] : n).map((e) => Fo(e, Xo, Zo, "mono", Ro)), i = e.lang?.trim() ?? "", a = e.title?.trim() ?? "", o = i && a ? `${i} · ${a}` : i || a, s = o ? Fo(o, Xo, 412, "mono", Ro) : "", c = s ? 30 : 0, l = (e) => Ro(e, Xo, "mono");
	return {
		header: s,
		headerHeight: c,
		lines: r,
		minBoxW: Math.max(s ? l(`{ } ${s}`) : 0, ...r.map(l)) + Wo + 26,
		height: c + 21 + (r.length - 1) * 19 + Qo
	};
}
function es(e) {
	let t = 0;
	for (let n of e) n === "…" && t++;
	return t;
}
function ts(e, t, n) {
	let r = Io(e, 14, t, Go, "normal", Ro), i = r.length;
	if (e.includes("\n") || i < 2) return r;
	let a = es(e);
	if (es(r.join("")) > a || n >= t) return r;
	let o = r, s = n, c = t;
	for (let t = 0; t < 8; t++) {
		let t = (s + c) / 2, n = Io(e, 14, t, Go, "normal", Ro);
		n.length <= i && es(n.join("")) <= a ? (o = n, c = t) : s = t;
	}
	return o;
}
var ns = .25;
function rs(e, t) {
	let n = Io(e, 14, t, Go, "normal", Ro);
	if (n.length < 2 || e.includes("\n")) return n;
	let r = (e) => Ro(e[e.length - 1] ?? "", 14, "normal") < ns * t;
	if (!r(n)) return n;
	let i = es(e);
	for (let a = t - 6; a >= Math.max(Ko, t * .55); a -= 6) {
		let t = Io(e, 14, a, Go, "normal", Ro);
		if (t.length !== n.length || es(t.join("")) > i) break;
		if (!r(t)) return t;
	}
	return n;
}
var is = (e) => e.reduce((e, t) => Math.max(e, Ro(t, 14, "normal")), 0);
function as(e, t, n) {
	let r = t > 0 ? (e ? qo.withLabel : qo.bare) + (t - 1) * 22 : e ? 27 : void 0;
	if (n === void 0) return {
		offsetY: 0,
		height: t === 0 ? 36 : (r ?? 0) + Jo
	};
	let i = r === void 0 ? Bo : r + Yo;
	return {
		offsetY: i,
		height: i + n + Bo
	};
}
function os(e) {
	let t = ss(e), n = e.code ? v(e.code.body, { stripAllOuterBlankLines: !0 }).split("\n") : [], r = t?.code?.lines ?? [], i = n.length > 10;
	return {
		label: !!e.label && t?.label !== e.label,
		description: es((t?.descLines ?? []).join("")) > es(e.description ?? ""),
		codeLines: i ? n.length : 0,
		wideCodeLines: n.flatMap((e, t) => t < r.length - +!!i && r[t] !== e ? [t + 1] : [])
	};
}
function ss(e) {
	let t = e.code ? $o(e.code) : void 0, n = e.label ? Fo(e.label, 15, Vo, "bold", Ro) : "", r = n ? Ro(n, 15, "bold") : 0, i = e.stopLabel === void 0 ? 0 : 28, a = n ? 0 : i, o = n ? i + r + Uo : 0, s = Math.max(o, t ? t.minBoxW : 0), c = e.description || t !== void 0 ? 16 : zo, l = (e) => Math.max(t ? Ho : e.length > 0 ? 210 : 60, Math.ceil(Math.max(s, e.length > 0 ? is(e) + Uo : 0) + c * 2)) + a, u = [];
	if (e.description) {
		let t = Math.max(Vo, s - Uo);
		u = ts(e.description, t, Ko), u = rs(e.description, Math.max(s, is(u) + Uo) - Uo);
	}
	if (!n && u.length === 0 && !t) return null;
	let { offsetY: d, height: f } = as(n !== "", u.length, t?.height), p = l(u), m = {
		halfW: p / 2,
		height: f,
		padX: c,
		label: n,
		descLines: u,
		numberRoom: i,
		bodyIndent: a
	};
	return t && (m.code = {
		header: t.header,
		headerHeight: t.headerHeight,
		lines: t.lines,
		offsetY: d,
		width: p - a - c * 2,
		height: t.height
	}), m;
}
// src/scene/paint.ts
var cs = {
	fg: "var(--dav-fg)",
	bg: "var(--dav-bg)",
	muted: "var(--dav-muted)",
	panel: "var(--dav-panel)",
	border: "var(--dav-border)",
	borderStrong: "var(--dav-border-strong)",
	accent: "var(--dav-accent)",
	accentText: "var(--dav-accent-text)",
	onAccent: "var(--dav-on-accent)",
	nodeBg: "var(--dav-node-bg)",
	edge: "var(--dav-edge)",
	codeBg: "var(--dav-code-bg)",
	codeHeadBg: "var(--dav-code-head-bg)",
	codeKey: "var(--dav-code-key)",
	codeStr: "var(--dav-code-str)",
	codeNum: "var(--dav-code-num)",
	codeKw: "var(--dav-code-kw)",
	codePunc: "var(--dav-code-punc)"
}, ls = {
	size: 16,
	inset: 14,
	baseline: 24,
	endGap: 4,
	lineHeight: 20
};
function us(e) {
	return Math.max(40, e - ls.inset - ls.endGap);
}
cs.borderStrong;
// src/scene/textCuts.ts
var ds = (e, t, n, r) => Fo(e, t, n, r) !== e;
function fs(e, t) {
	let n = [], r = W.width;
	for (let t of e.nodes) Lo(t.label, 14, r, 2, "bold") && n.push({
		kind: "node-label",
		node: t.id,
		text: t.label
	}), t.sub && ds(t.sub, 11.5, r) && n.push({
		kind: "node-sub",
		node: t.id,
		text: t.sub
	}), t.badge && ds(t.badge, 11, 120, "bold") && n.push({
		kind: "node-badge",
		node: t.id,
		text: t.badge
	});
	if (t) for (let r of e.groups) {
		let e = t.groups[r.id];
		e && Lo(r.label, ls.size, us(e.width), 2) && n.push({
			kind: "zone-label",
			group: r.id,
			text: r.label
		});
	}
	for (let t of e.steps) {
		for (let e of t.states) e.badge && ds(e.badge, 11, 120, "bold") && n.push({
			kind: "state-badge",
			step: t.index,
			target: e.target,
			text: e.badge
		});
		for (let e of t.statics) e.label && ds(e.label, 11.5, 188) && n.push({
			kind: "static-label",
			step: t.index,
			from: e.from,
			to: e.to,
			text: e.label
		});
		for (let e of t.animations) {
			let r = {
				step: t.index,
				from: e.from,
				to: e.to
			}, i = os(e);
			i.label && e.label && n.push({
				kind: "packet-label",
				...r,
				text: e.label
			}), i.description && e.description && n.push({
				kind: "packet-desc",
				...r,
				text: e.description
			}), i.codeLines > 0 && n.push({
				kind: "code-lines",
				...r,
				lines: i.codeLines
			});
			for (let e of i.wideCodeLines) n.push({
				kind: "code-width",
				...r,
				line: e
			});
		}
	}
	return n;
}
// src/skill/review.ts
var ps = 3, ms = (e) => `step ${e.index + 1} "${e.title}"`, hs = (e) => `animate ${e.from} ${Za(e)} ${e.to}`;
function gs(e, t) {
	let n = "step" in e ? t.steps[e.step] : void 0, r = n ? `${ms(n)}: ` : "";
	switch (e.kind) {
		case "node-label": return `The label of node ${e.node} is too long for its place and is cut off: "${e.text}". Shorten it, and move detail into sub.`;
		case "zone-label": return `The label of group ${e.group} is too long for its zone and is cut off: "${e.text}". Shorten it.`;
		case "node-sub": return `The sub of node ${e.node} is too long and is cut off: "${e.text}". Shorten it.`;
		case "node-badge": return `The badge of node ${e.node} is too long and is cut off: "${e.text}". A badge is a word or two.`;
		case "state-badge": return `${r}the badge set on ${e.target} is too long and is cut off: "${e.text}". A badge is a word or two.`;
		case "static-label": {
			let t = n?.statics.find((t) => t.from === e.from && t.to === e.to && t.label === e.text);
			return `${r}the label of static ${e.from} ${t ? Za(t) : "-->"} ${e.to} is too long and is cut off: "${e.text}". Shorten it.`;
		}
		case "packet-label": return `${r}the label of the packet from ${e.from} to ${e.to} is too long and is cut off: "${e.text}". Keep the label short, and move the rest into desc.`;
		case "packet-desc": return `${r}the desc of the packet from ${e.from} to ${e.to} is longer than the four lines a callout shows, and is cut off. Shorten it to one or two sentences.`;
		case "code-lines": return `${r}the code of the packet from ${e.from} to ${e.to} has ${e.lines} lines, and a callout shows 10. Keep the lines that matter.`;
		case "code-width": return `${r}line ${e.line} of the code of the packet from ${e.from} to ${e.to} is too wide and is cut off. Break it, or shorten it to about 55 characters, or 35 Japanese ones.`;
	}
}
function _s(e) {
	let t = [], n = (e, n) => {
		t.push({
			code: e,
			message: n
		});
	};
	for (let t of e.steps) {
		t.description.trim() || n("step-without-desc", `${ms(t)} has no desc. Add one or two sentences that say what happens in it and why.`), t.animations.length === 0 && t.statics.length === 0 && t.states.length === 0 && t.focus.length === 0 && n("empty-step", `${ms(t)} shows nothing: it has no animate, static, state or focus.`);
		for (let e of t.animations) e.label || n("animate-without-label", `${ms(t)}: ${hs(e)} has no label. Name what is sent, such as : "POST /orders".`), e.description?.trim() || n("animate-without-desc", `${ms(t)}: ${hs(e)} has no desc. Add [desc: "..."] that says what this message does or decides.`);
	}
	let r = e.steps.flatMap((e) => e.animations);
	r.length >= ps && !r.some((e) => e.code?.body.trim()) && n("no-code", "No animate shows a code block. Attach the request, query, event or response that matters most to one to three of them.");
	let i = e.groups.length > 0 ? Ba(e) : void 0;
	for (let t of fs(e, i)) n("text-cut", gs(t, e));
	return t;
}
// src/skill/check.ts
var vs = "Usage: node dav-check.mjs [--write] [--detail] [--map] <file.dav>...", ys = [
	"--write",
	"--detail",
	"--map"
], bs = 0, xs = 1, Ss = 2;
function Cs(e, t) {
	let n = Number.isNaN(t) ? 0 : Math.max(0, Math.min(e.length, Math.trunc(t))), r = n === 0 ? 1 : n - e.lastIndexOf("\n", n - 1);
	return `${y(e, n)}:${r}`;
}
function ws(e, t, n) {
	return Xa(`${e}:${Cs(t, n.from)}: ${n.severity} ${n.code}: ${Et(n)}`);
}
function Ts(n, r, i, a) {
	let o = e(n, "utf8").replace(/^﻿/, "");
	if (r) {
		let e = jt(o);
		e !== o && (t(n, e), o = e);
	}
	let { document: s, diagnostics: c } = vt(o), l = (e) => console.log(Xa(e));
	for (let e of c) l(ws(n, o, e));
	let u = i && c.length === 0 ? _s(s) : [];
	for (let e of u) l(`${n}: hint ${e.code}: ${e.message}`);
	if (i && c.length === 0) {
		let { summary: e, notes: t } = To(s);
		for (let t of e) l(`${n}: ${t}`);
		for (let e of t) l(`${n}: note ${e.code}: ${e.message}`);
	}
	if (a && c.length === 0) for (let e of lo(s)) l(`${n}: map: ${e}`);
	if (c.length === 0 && u.length === 0) {
		let { nodes: e, steps: t } = s, r = U(s);
		l(`${n}: ok (${e.length} nodes, ${r.length} edges, ${t.length} steps)`);
	}
	return c.length === 0 && u.length === 0;
}
function Es(e, t = vs) {
	if (e.includes("--help") || e.includes("-h")) return console.log(t), bs;
	let n = e.filter((e) => !ys.includes(e));
	if (n.length === 0 || n.some((e) => e.startsWith("-"))) return console.error(t), Ss;
	let r = !0;
	for (let t of n) try {
		let n = (t) => e.includes(t);
		Ts(t, n("--write"), n("--detail"), n("--map")) || (r = !1);
	} catch (e) {
		return console.error(`${t}: ${e instanceof Error ? e.message : String(e)}`), Ss;
	}
	return r ? bs : xs;
}
// src/skill/checkEntry.ts
process.exitCode = Es(process.argv.slice(2));
