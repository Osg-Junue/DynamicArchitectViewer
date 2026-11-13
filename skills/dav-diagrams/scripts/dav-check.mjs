// Generated from apps/vscode/src/skill/checkEntry.ts. Do not edit.
import { readFileSync as e, writeFileSync as t } from "node:fs";
// src/model/types.ts
var n = /* @__PURE__ */ "server.container.function.runtime.database.cache.queue.storage.lb.firewall.cdn.cloud.building.router.hub.wifi.external.auth.ai.api.mail.monitor.schedule.search.logic.webhook.payment.key.screen.modal.browser.desktop.mobile.terminal.device.printer.chat.sheet.file.user.users.bot".split(".");
function r(e) {
	return n.includes(e);
}
var i = [
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
function a(e) {
	return i.includes(e);
}
var o = "none", s = [
	"dav",
	"title",
	"group",
	"node",
	"step",
	"desc",
	"focus",
	"state",
	"animate",
	"true",
	"false"
];
function c(e, t) {
	return `${e}->${t}`;
}
var l = {
	node: {
		icon: "icon",
		sub: "string",
		badge: "string",
		visible: "bool",
		color: "color"
	},
	group: { color: "color" },
	edge: {
		id: "ident",
		visible: "bool",
		color: "color"
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
	}
}, u = {
	node: /* @__PURE__ */ new Set([
		"badge",
		"visible",
		"color"
	]),
	group: /* @__PURE__ */ new Set(["color"]),
	edge: /* @__PURE__ */ new Set(["visible", "color"])
}, d = [
	"-->",
	"..>",
	"<->",
	"<.>"
], f = {
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
new Set(s);
// src/dsl/suggest.ts
function p(e, t) {
	let n, r = 3, i = e.toLowerCase();
	for (let e of t) {
		let t = e.length <= 3 ? 1 : 2, a = m(i, e);
		a <= t && a < r && (n = e, r = a);
	}
	return n;
}
function m(e, t) {
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
// src/model/text.ts
var h = {
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
}, g = 32, _ = 126, v = {
	normal: .6,
	bold: .65,
	mono: .605
}, y = 1, b = 1.4, x = 127744;
function S(e, t) {
	let n = e.codePointAt(0) ?? 0;
	return t !== "mono" && n >= g && n <= _ ? h[t][n - g] / 100 : w(e) ? n >= x ? b : y : v[t];
}
function C(e, t, n = "normal") {
	let r = 0;
	for (let t of e) r += S(t, n);
	return r * t;
}
function w(e) {
	if (ee(e)) return !0;
	let t = e.codePointAt(0) ?? 0;
	return t === 165 || t === 183 || t === 215 || t === 247 || t >= 8192 && t <= 11263 || t >= 12288 && t <= 12351 || t >= 65024 && t <= 65135;
}
function ee(e) {
	let t = e.codePointAt(0) ?? 0;
	return t >= 4352 && t <= 4447 || t >= 11904 && t <= 42191 || t >= 44032 && t <= 55203 || t >= 63744 && t <= 64255 || t >= 65072 && t <= 65103 || t >= 65280 && t <= 65376 || t >= 65504 && t <= 65510 || t >= 127744;
}
function T(e, t) {
	let n = e.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
	if (!t?.stripAllOuterBlankLines && !n.includes("\n")) return n.trim();
	let r = n.split("\n");
	if (t?.stripAllOuterBlankLines) {
		for (; r.length > 0 && r[0]?.trim() === "";) r.shift();
		for (; r.length > 0 && r[r.length - 1]?.trim() === "";) r.pop();
		if (r.length === 0) return "";
	} else r.length > 0 && r[0]?.trim() === "" && r.shift(), r.length > 0 && r[r.length - 1]?.trim() === "" && r.pop();
	let i = r.map((e) => e.trimEnd()), a = Infinity;
	for (let e of i) {
		if (e.length === 0) continue;
		let t = /^ */.exec(e)?.[0].length ?? 0;
		t < a && (a = t);
	}
	return !Number.isFinite(a) || a === 0 ? i.join("\n") : i.map((e) => e.length > 0 ? e.slice(a) : "").join("\n");
}
function te(e, t) {
	let n = Number.isNaN(t) ? 0 : Math.max(0, Math.min(e.length, Math.trunc(t))), r = 1;
	for (let t = 0; t < n; t++) e.charCodeAt(t) === 10 && r++;
	return r;
}
function E(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
// ../../node_modules/@lezer/common/dist/index.js
var D = 1024, ne = 0, re = class {
	constructor(e, t) {
		this.from = e, this.to = t;
	}
}, O = class {
	constructor(e = {}) {
		this.id = ne++, this.perNode = !!e.perNode, this.deserialize = e.deserialize || (() => {
			throw Error("This node type doesn't define a deserialize function");
		}), this.combine = e.combine || null;
	}
	add(e) {
		if (this.perNode) throw RangeError("Can't add per-node props to node types");
		return typeof e != "function" && (e = A.match(e)), (t) => {
			let n = e(t);
			return n === void 0 ? null : [this, n];
		};
	}
};
O.closedBy = new O({ deserialize: (e) => e.split(" ") }), O.openedBy = new O({ deserialize: (e) => e.split(" ") }), O.group = new O({ deserialize: (e) => e.split(" ") }), O.isolate = new O({ deserialize: (e) => {
	if (e && e != "rtl" && e != "ltr" && e != "auto") throw RangeError("Invalid value for isolate: " + e);
	return e || "auto";
} }), O.contextHash = new O({ perNode: !0 }), O.lookAhead = new O({ perNode: !0 }), O.mounted = new O({ perNode: !0 });
var k = class {
	constructor(e, t, n, r = !1) {
		this.tree = e, this.overlay = t, this.parser = n, this.bracketed = r;
	}
	static get(e) {
		return e && e.props && e.props[O.mounted.id];
	}
}, ie = Object.create(null), A = class e {
	constructor(e, t, n, r = 0) {
		this.name = e, this.props = t, this.id = n, this.flags = r;
	}
	static define(t) {
		let n = t.props && t.props.length ? Object.create(null) : ie, r = +!!t.top | (t.skipped ? 2 : 0) | (t.error ? 4 : 0) | (t.name == null ? 8 : 0), i = new e(t.name || "", n, t.id, r);
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
			let t = this.prop(O.group);
			return t ? t.indexOf(e) > -1 : !1;
		}
		return this.id == e;
	}
	static match(e) {
		let t = Object.create(null);
		for (let n in e) for (let r of n.split(" ")) t[r] = e[n];
		return (e) => {
			for (let n = e.prop(O.group), r = -1; r < (n ? n.length : 0); r++) {
				let i = t[r < 0 ? e.name : n[r]];
				if (i) return i;
			}
		};
	}
};
A.none = new A("", Object.create(null), 0, 8);
var ae = class e {
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
			n.push(r ? new A(e.name, r, e.id, e.flags) : e);
		}
		return new e(n);
	}
}, oe = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), j;
(function(e) {
	e[e.ExcludeBuffers = 1] = "ExcludeBuffers", e[e.IncludeAnonymous = 2] = "IncludeAnonymous", e[e.IgnoreMounts = 4] = "IgnoreMounts", e[e.IgnoreOverlays = 8] = "IgnoreOverlays", e[e.EnterBracketed = 16] = "EnterBracketed";
})(j ||= {});
var M = class e {
	constructor(e, t, n, r, i) {
		if (this.type = e, this.children = t, this.positions = n, this.length = r, this.props = null, i && i.length) {
			this.props = Object.create(null);
			for (let [e, t] of i) this.props[typeof e == "number" ? e : e.id] = t;
		}
	}
	toString() {
		let e = k.get(this);
		if (e && !e.overlay) return e.tree.toString();
		let t = "";
		for (let e of this.children) {
			let n = e.toString();
			n && (t && (t += ","), t += n);
		}
		return this.type.name ? (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (t.length ? "(" + t + ")" : "") : t;
	}
	cursor(e = 0) {
		return new ve(this.topNode, e);
	}
	cursorAt(e, t = 0, n = 0) {
		let r = new ve(oe.get(this) || this.topNode);
		return r.moveTo(e, t), oe.set(this, r._tree), r;
	}
	get topNode() {
		return new F(this, 0, 0, null);
	}
	resolve(e, t = 0) {
		let n = P(oe.get(this) || this.topNode, e, t, !1);
		return oe.set(this, n), n;
	}
	resolveInner(e, t = 0) {
		let n = P(se.get(this) || this.topNode, e, t, !0);
		return se.set(this, n), n;
	}
	resolveStack(e, t = 0) {
		return _e(this, e, t);
	}
	iterate(e) {
		let { enter: t, leave: n, from: r = 0, to: i = this.length } = e, a = e.mode || 0, o = (a & j.IncludeAnonymous) > 0;
		for (let e = this.cursor(a | j.IncludeAnonymous);;) {
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
		return this.children.length <= 8 ? this : Ce(A.none, this.children, this.positions, 0, this.children.length, 0, this.length, (t, n, r) => new e(this.type, t, n, r, this.propValues), t.makeTree || ((t, n, r) => new e(A.none, t, n, r)));
	}
	static build(e) {
		return be(e);
	}
};
M.empty = new M(A.none, [], [], 0);
var ce = class e {
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
}, N = class e {
	constructor(e, t, n) {
		this.buffer = e, this.length = t, this.set = n;
	}
	get type() {
		return A.none;
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
		for (let s = e; s != t && !(le(i, r, a[s + 1], a[s + 2]) && (o = s, n > 0)); s = a[s + 3]);
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
function le(e, t, n, r) {
	switch (e) {
		case -2: return n < t;
		case -1: return r >= t && n < t;
		case 0: return n < t && r > t;
		case 1: return n <= t && r > t;
		case 2: return r > t;
		case 4: return !0;
	}
}
function P(e, t, n, r) {
	for (; e.from == e.to || (n < 1 ? e.from >= t : e.from > t) || (n > -1 ? e.to <= t : e.to < t);) {
		let t = !r && e instanceof F && e.index < 0 ? null : e.parent;
		if (!t) return e;
		e = t;
	}
	let i = r ? 0 : j.IgnoreOverlays;
	if (r) for (let r = e, a = r.parent; a; r = a, a = r.parent) r instanceof F && r.index < 0 && a.enter(t, n, i)?.from != r.from && (e = a);
	for (;;) {
		let r = e.enter(t, n, i);
		if (!r) return e;
		e = r;
	}
}
var ue = class {
	cursor(e = 0) {
		return new ve(this, e);
	}
	getChild(e, t = null, n = null) {
		let r = de(this, e, t, n);
		return r.length ? r[0] : null;
	}
	getChildren(e, t = null, n = null) {
		return de(this, e, t, n);
	}
	resolve(e, t = 0) {
		return P(this, e, t, !1);
	}
	resolveInner(e, t = 0) {
		return P(this, e, t, !0);
	}
	matchContext(e) {
		return fe(this.parent, e);
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
}, F = class e extends ue {
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
				if (a & j.EnterBracketed && l instanceof M && (d = k.get(l)) && !d.overlay && d.bracketed && r >= u && r <= u + l.length || le(i, r, u, u + l.length)) {
					if (l instanceof N) {
						if (a & j.ExcludeBuffers) continue;
						let e = l.findChild(0, l.buffer.length, n, r - u, i);
						if (e > -1) return new me(new pe(o, l, t, u), null, e);
					} else if (a & j.IncludeAnonymous || !l.type.isAnonymous || ye(l)) {
						let s;
						if (!(a & j.IgnoreMounts) && (s = k.get(l)) && !s.overlay) return new e(s.tree, u, t, o);
						let c = new e(l, u, t, o);
						return a & j.IncludeAnonymous || !c.type.isAnonymous ? c : c.nextChild(n < 0 ? l.children.length - 1 : 0, n, r, i, a);
					}
				}
			}
			if (a & j.IncludeAnonymous || !o.type.isAnonymous || (t = o.index >= 0 ? o.index + n : n < 0 ? -1 : o._parent._tree.children.length, o = o._parent, !o)) return null;
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
		if (!(r & j.IgnoreOverlays) && (i = k.get(this._tree)) && i.overlay) {
			let a = t - this.from, o = r & j.EnterBracketed && i.bracketed;
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
function de(e, t, n, r) {
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
function fe(e, t, n = t.length - 1) {
	for (let r = e; n >= 0; r = r.parent) {
		if (!r) return !1;
		if (!r.type.isAnonymous) {
			if (t[n] && t[n] != r.name) return !1;
			n--;
		}
	}
	return !0;
}
var pe = class {
	constructor(e, t, n, r) {
		this.parent = e, this.buffer = t, this.index = n, this.start = r;
	}
}, me = class e extends ue {
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
		if (r & j.ExcludeBuffers) return null;
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
		return new M(this.type, e, t, this.to - this.from);
	}
	toString() {
		return this.context.buffer.childString(this.index);
	}
};
function he(e) {
	if (!e.length) return null;
	let t = 0, n = e[0];
	for (let r = 1; r < e.length; r++) {
		let i = e[r];
		(i.from > n.from || i.to < n.to) && (n = i, t = r);
	}
	let r = n instanceof F && n.index < 0 ? null : n.parent, i = e.slice();
	return r ? i[t] = r : i.splice(t, 1), new ge(i, n);
}
var ge = class {
	constructor(e, t) {
		this.heads = e, this.node = t;
	}
	get next() {
		return he(this.heads);
	}
};
function _e(e, t, n) {
	let r = e.resolveInner(t, n), i = null;
	for (let e = r instanceof F ? r : r.context.parent; e; e = e.parent) if (e.index < 0) {
		let a = e.parent;
		(i ||= [r]).push(a.resolve(t, n)), e = a;
	} else {
		let a = k.get(e.tree);
		if (a && a.overlay && a.overlay[0].from <= t && a.overlay[a.overlay.length - 1].to >= t) {
			let o = new F(a.tree, a.overlay[0].from + e.from, -1, e);
			(i ||= [r]).push(P(o, t, n, !1));
		}
	}
	return i ? he(i) : r;
}
var ve = class {
	get name() {
		return this.type.name;
	}
	constructor(e, t = 0) {
		if (this.buffer = null, this.stack = [], this.index = 0, this.bufferNode = null, this.mode = t & ~j.EnterBracketed, e instanceof F) this.yieldNode(e);
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
		return e ? e instanceof F ? (this.buffer = null, this.yieldNode(e)) : (this.buffer = e.context, this.yieldBuf(e.index, e.type)) : !1;
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
		return this.buffer ? n & j.ExcludeBuffers ? !1 : this.enterChild(1, e, t) : this.yield(this._tree.enter(e, t, n));
	}
	parent() {
		if (!this.buffer) return this.yieldNode(this.mode & j.IncludeAnonymous ? this._tree._parent : this._tree.parent);
		if (this.stack.length) return this.yieldBuf(this.stack.pop());
		let e = this.mode & j.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
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
			if (this.mode & j.IncludeAnonymous || e instanceof N || !e.type.isAnonymous || ye(e)) return !1;
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
		for (let e = n; e < this.stack.length; e++) t = new me(this.buffer, t, this.stack[e]);
		return this.bufferNode = new me(this.buffer, t, this.index);
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
		if (!this.buffer) return fe(this.node.parent, e);
		let { buffer: t } = this.buffer, { types: n } = t.set;
		for (let r = e.length - 1, i = this.stack.length - 1; r >= 0; i--) {
			if (i < 0) return fe(this._tree, e, r);
			let a = n[t.buffer[this.stack[i]]];
			if (!a.isAnonymous) {
				if (e[r] && e[r] != a.name) return !1;
				r--;
			}
		}
		return !0;
	}
};
function ye(e) {
	return e.children.some((e) => e instanceof N || !e.type.isAnonymous || ye(e));
}
function be(e) {
	let { buffer: t, nodeSet: n, maxBufferLength: r = D, reused: i = [], minRepeatType: a = n.types.length } = e, o = Array.isArray(t) ? new ce(t, t.length) : t, s = n.types, c = 0, l = 0;
	function u(e, t, _, v, y, b) {
		let { id: x, start: S, end: C, size: w } = o, ee = l, T = c;
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
		let te = s[x], E, D, ne = S - e;
		if (C - S <= r && (D = h(o.pos - t, y))) {
			let t = new Uint16Array(D.size - D.skip), r = o.pos - D.size, i = t.length;
			for (; o.pos > r;) i = g(D.start, t, i);
			E = new N(t, C - D.start, n), ne = D.start - e;
		} else {
			let e = o.pos - w;
			o.next();
			let t = [], s = [], c = x >= a ? x : -1, h = 0, g = C, _ = ee;
			for (; o.pos > e;) c >= 0 && o.id == c && o.size >= 0 ? (o.end <= g - r && (p(t, s, S, h, o.end, g, c, _, T), h = t.length, g = o.end, _ = l), o.next()) : b > 2500 ? d(S, e, t, s) : (c >= 0 && o.size == -1 && i[o.id].type == n.types[c] && (h < t.length && p(t, s, S, h, o.end, g, c, _, T), h = t.length + 1, g = o.start, _ = l), u(S, e, t, s, c, b + 1));
			if (c >= 0 && h > 0 && h < t.length && p(t, s, S, h, S, g, c, _, T), t.reverse(), s.reverse(), c > -1 && h > 0) {
				let e = f(te, T);
				E = Ce(te, t, s, 0, t.length, 0, C - S, e, e);
			} else E = m(te, t, s, C - S, ee - C, T);
		}
		_.push(E), v.push(ne);
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
			i.push(new N(t, s[2] - r, n)), a.push(r - e);
		}
	}
	function f(e, t) {
		return (n, r, i) => {
			let a = 0, o = n.length - 1, s, c;
			if (o >= 0 && (s = n[o]) instanceof M) {
				if (!o && s.type == e && s.length == i) return s;
				(c = s.prop(O.lookAhead)) && (a = r[o] + s.length + c - i);
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
			let e = [O.contextHash, a];
			o = o ? [e].concat(o) : [e];
		}
		if (i > 25) {
			let e = [O.lookAhead, i];
			o = o ? [e].concat(o) : [e];
		}
		return new M(e, t, n, r, o);
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
	return new M(s[e.topID], _.reverse(), v.reverse(), y);
}
var xe = /* @__PURE__ */ new WeakMap();
function Se(e, t) {
	if (!e.isAnonymous || t instanceof N || t.type != e) return 1;
	let n = xe.get(t);
	if (n == null) {
		n = 1;
		for (let r of t.children) {
			if (r.type != e || !(r instanceof M)) {
				n = 1;
				break;
			}
			n += Se(e, r);
		}
		xe.set(t, n);
	}
	return n;
}
function Ce(e, t, n, r, i, a, o, s, c) {
	let l = 0;
	for (let n = r; n < i; n++) l += Se(e, t[n]);
	let u = Math.ceil(l * 1.5 / 8), d = [], f = [];
	function p(t, n, r, i, o) {
		for (let s = r; s < i;) {
			let r = s, l = n[s], m = Se(e, t[s]);
			for (s++; s < i; s++) {
				let n = Se(e, t[s]);
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
				d.push(Ce(e, t, n, r, s, l, i, null, c));
			}
			f.push(l + o - a);
		}
	}
	return p(t, n, r, i, 0), (s || c)(d, f, o);
}
var we = class {
	startParse(e, t, n) {
		return typeof e == "string" && (e = new Te(e)), n = n ? n.length ? n.map((e) => new re(e.from, e.to)) : [new re(0, 0)] : [new re(0, e.length)], this.createParse(e, t || [], n);
	}
	parse(e, t, n) {
		let r = this.startParse(e, t, n);
		for (;;) {
			let e = r.advance();
			if (e) return e;
		}
	}
}, Te = class {
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
new O({ perNode: !0 });
// ../../node_modules/@lezer/lr/dist/index.js
var Ee = class e {
	constructor(e, t, n, r, i, a, o, s, c, l = 0, u) {
		this.p = e, this.stack = t, this.state = n, this.reducePos = r, this.pos = i, this.score = a, this.buffer = o, this.bufferBase = s, this.curContext = c, this.lookAhead = l, this.parent = u;
	}
	toString() {
		return `[${this.stack.filter((e, t) => t % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
	}
	static start(t, n, r = 0) {
		let i = t.parser.context;
		return new e(t, [], n, r, r, 0, [], 0, i ? new De(i, i.start) : null, 0, null);
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
		for (let t = new Oe(this);;) {
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
			let t = new De(this.curContext.tracker, e);
			t.hash != this.curContext.hash && this.emitContext(), this.curContext = t;
		}
	}
	setLookAhead(e) {
		return e <= this.lookAhead ? !1 : (this.emitLookAhead(), this.lookAhead = e, !0);
	}
	close() {
		this.curContext && this.curContext.tracker.strict && this.emitContext(), this.lookAhead > 0 && this.emitLookAhead();
	}
}, De = class {
	constructor(e, t) {
		this.tracker = e, this.context = t, this.hash = e.strict ? e.hash(t) : 0;
	}
}, Oe = class {
	constructor(e) {
		this.start = e, this.state = e.state, this.stack = e.stack, this.base = this.stack.length;
	}
	reduce(e) {
		let t = e & 65535, n = e >> 19;
		n == 0 ? (this.stack == this.start.stack && (this.stack = this.stack.slice()), this.stack.push(this.state, 0, 0), this.base += 3) : this.base -= (n - 1) * 3;
		let r = this.start.p.parser.getGoto(this.stack[this.base - 3], t, !0);
		this.state = r;
	}
}, ke = class e {
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
function I(e, t = Uint16Array) {
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
var Ae = class {
	constructor() {
		this.start = -1, this.value = -1, this.end = -1, this.extended = -1, this.lookAhead = 0, this.mask = 0, this.context = 0;
	}
}, je = new Ae(), Me = class {
	constructor(e, t) {
		this.input = e, this.ranges = t, this.chunk = "", this.chunkOff = 0, this.chunk2 = "", this.chunk2Pos = 0, this.next = -1, this.token = je, this.rangeIndex = 0, this.pos = this.chunkPos = t[0].from, this.range = t[0], this.end = t[t.length - 1].to, this.readNext();
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
		if (t ? (this.token = t, t.start = e, t.lookAhead = e + 1, t.value = t.extended = -1) : this.token = je, this.pos != e) {
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
}, L = class {
	constructor(e, t) {
		this.data = e, this.id = t;
	}
	token(e, t) {
		let { parser: n } = t.p;
		Pe(this.data, e, t, this.id, n.data, n.tokenPrecTable);
	}
};
L.prototype.contextual = L.prototype.fallback = L.prototype.extend = !1;
var Ne = class {
	constructor(e, t, n) {
		this.precTable = t, this.elseToken = n, this.data = typeof e == "string" ? I(e) : e;
	}
	token(e, t) {
		let n = e.pos, r = 0;
		for (;;) {
			let n = e.next < 0, i = e.resolveOffset(1, 1);
			if (Pe(this.data, e, t, 0, this.data, this.precTable), e.token.value > -1) break;
			if (this.elseToken == null) return;
			if (n || r++, i == null) break;
			e.reset(i, e.token);
		}
		r && (e.reset(n, e.token), e.acceptToken(this.elseToken, r));
	}
};
Ne.prototype.contextual = L.prototype.fallback = L.prototype.extend = !1;
function Pe(e, t, n, r, i, a) {
	let o = 0, s = 1 << r, { dialect: c } = n.p.parser;
	scan: for (; (s & e[o]) != 0;) {
		let n = e[o + 1];
		for (let r = o + 3; r < n; r += 2) if ((e[r + 1] & s) > 0) {
			let n = e[r];
			if (c.allows(n) && (t.token.value == -1 || t.token.value == n || Ie(n, t.token.value, i, a))) {
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
function Fe(e, t, n) {
	for (let r = t, i; (i = e[r]) != 65535; r++) if (i == n) return r - t;
	return -1;
}
function Ie(e, t, n, r) {
	let i = Fe(n, r, t);
	return i < 0 || Fe(n, r, e) < i;
}
var R = typeof process < "u" && process.env && /\bparse\b/.test(process.env.LOG), Le = null;
function Re(e, t, n) {
	let r = e.cursor(j.IncludeAnonymous);
	for (r.moveTo(t);;) if (!(n < 0 ? r.childBefore(t) : r.childAfter(t))) for (;;) {
		if ((n < 0 ? r.to < t : r.from > t) && !r.type.isError) return n < 0 ? Math.max(0, Math.min(r.to - 1, t - 25)) : Math.min(e.length, Math.max(r.from + 1, t + 25));
		if (n < 0 ? r.prevSibling() : r.nextSibling()) break;
		if (!r.parent()) return n < 0 ? 0 : e.length;
	}
}
var ze = class {
	constructor(e, t) {
		this.fragments = e, this.minRepeat = t, this.i = 0, this.fragment = null, this.safeFrom = -1, this.safeTo = -1, this.trees = [], this.start = [], this.index = [], this.lastRepeat = null, this.lastRepeatPos = -1, this.nextFragment();
	}
	nextFragment() {
		let e = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
		if (e) {
			for (this.safeFrom = e.openStart ? Re(e.tree, e.from + e.offset, 1) - e.offset : e.from, this.safeTo = e.openEnd ? Re(e.tree, e.to + e.offset, -1) - e.offset : e.to; this.trees.length;) this.trees.pop(), this.start.pop(), this.index.pop();
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
			if (i instanceof M) {
				let n = a > this.lastRepeatPos && i.type.id >= this.minRepeat;
				if (a == e || n) {
					let t = a + i.length, r;
					if (a >= this.safeFrom && t <= this.safeTo && (!(r = i.prop(O.lookAhead)) || t + r < this.fragment.to) && (n && (this.lastRepeat = i, this.lastRepeatPos = a), a == e)) return i;
				}
				this.index[t]++, a + i.length >= Math.max(this.safeFrom, e) && (this.trees.push(i), this.start.push(a), this.index.push(0));
			} else this.index[t]++, this.nextStart = a + i.length;
		}
	}
}, Be = class {
	constructor(e, t) {
		this.stream = t, this.tokens = [], this.mainToken = null, this.actions = [], this.tokens = e.tokenizers.map((e) => new Ae());
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
		return s && e.setLookAhead(s), !n && e.pos == this.stream.end && (n = new Ae(), n.value = e.p.parser.eofTerm, n.start = n.end = e.pos, t = this.addActions(e, n.value, n.end, t)), this.mainToken = n, this.actions;
	}
	getMainToken(e) {
		if (this.mainToken) return this.mainToken;
		let t = new Ae(), { pos: n, p: r } = e;
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
				if (o[s + 1] == 1) s = z(o, s + 2);
				else {
					r == 0 && o[s + 1] == 2 && (r = this.putAction(z(o, s + 2), t, n, r));
					break;
				}
			}
			o[s] == t && (r = this.putAction(z(o, s + 1), t, n, r));
		}
		return r;
	}
}, Ve = class {
	constructor(e, t, n, r) {
		this.parser = e, this.input = t, this.ranges = r, this.recovering = 0, this.nextStackID = 9812, this.minStackPos = 0, this.reused = [], this.stoppedAt = null, this.lastBigReductionStart = -1, this.lastBigReductionSize = 0, this.bigReductionCount = 0, this.stream = new Me(t, r), this.tokens = new Be(e, this.stream), this.topTerm = e.top[1];
		let { from: i } = r[0];
		this.stacks = [Ee.start(this, e.top[0], i)], this.fragments = n.length && this.stream.end - i > e.bufferLength * 4 ? new ze(n, e.minRepeatTerm) : null;
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
			let e = r && Ge(r);
			if (e) return R && console.log("Finish with " + this.stackID(e)), this.stackToTree(e);
			if (this.parser.strict) throw R && r && console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none")), SyntaxError("No parse at " + t);
			this.recovering ||= 5;
		}
		if (this.recovering && r) {
			let e = this.stoppedAt != null && r[0].pos > this.stoppedAt ? r[0] : this.runRecovery(r, i, n);
			if (e) return R && console.log("Force-finish " + this.stackID(e)), this.stackToTree(e.forceAll());
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
			if (o > -1 && n.length && (!i || (n.prop(O.contextHash) || 0) == a)) return e.useNode(n, o, t), n;
			if (n.children.length == 0 || n.positions[0] > 0) break;
			let s = n.children[0];
			if (s instanceof M && (!r || s.type.id >= this.parser.minRepeatTerm)) n = s;
			else break;
		}
		return null;
	}
	advanceStack(e, t, n) {
		let r = e.pos, { parser: i } = this, a = R ? this.stackID(e) + " -> " : "";
		if (this.stoppedAt != null && r > this.stoppedAt) return e.forceReduce() ? e : null;
		if (this.fragments) {
			let t = e.reducePos < r && e.buffer.length && e.buffer[e.buffer.length - 2] <= e.reducePos && this.fragments.lastRepeatPos == e.reducePos && this.tryReuse(e, e.reducePos, this.fragments.lastRepeat, !0) || this.tryReuse(e, r, this.fragments.nodeAt(r), !1);
			if (t) return R && console.log(a + this.stackID(e) + ` (via reuse of ${i.getName(t.type.id)})`), !0;
		}
		let o = i.stateSlot(e.state, 4);
		if (o > 0) return e.reduce(o), R && console.log(a + this.stackID(e) + ` (via always-reduce ${i.getName(o & 65535)})`), !0;
		if (e.stack.length >= 8400) for (; e.stack.length > 6e3 && e.forceReduce(););
		let s = this.tokens.getActions(e);
		for (let o = 0; o < s.length;) {
			let c = s[o++], l = s[o++], u = s[o++], d = o == s.length || !n, f = d ? e : e.split(), p = this.tokens.mainToken;
			if (f.apply(c, l, p ? p.start : f.pos, u), R && console.log(a + this.stackID(f) + ` (via ${c & 65536 ? `reduce of ${i.getName(c & 65535)}` : "shift"} for ${i.getName(l)} @ ${r}${f == e ? "" : ", split"})`), d) return !0;
			f.pos > r ? t.push(f) : n.push(f);
		}
		return !1;
	}
	advanceFully(e, t) {
		let n = e.pos;
		for (;;) {
			if (!this.advanceStack(e, null, null)) return !1;
			if (e.pos > n) return He(e, t), !0;
		}
	}
	runRecovery(e, t, n) {
		let r = null, i = !1;
		for (let a = 0; a < e.length; a++) {
			let o = e[a], s = t[a << 1], c = t[(a << 1) + 1], l = R ? this.stackID(o) + " -> " : "";
			if (o.deadEnd && (i || (i = !0, o.restart(), R && console.log(l + this.stackID(o) + " (restarted)"), this.advanceFully(o, n)))) continue;
			let u = o.split(), d = l;
			for (let e = 0; e < 10 && u.forceReduce() && (R && console.log(d + this.stackID(u) + " (via force-reduce)"), !this.advanceFully(u, n)); e++) R && (d = this.stackID(u) + " -> ");
			for (let e of o.recoverByInsert(s)) R && console.log(l + this.stackID(e) + " (via recover-insert)"), this.advanceFully(e, n);
			this.stream.end > o.pos ? (c == o.pos && (c++, s = 0), o.recoverByDelete(s, c), R && console.log(l + this.stackID(o) + ` (via recover-delete ${this.parser.getName(s)})`), He(o, n)) : (!r || r.score < u.score) && (r = u);
		}
		return r;
	}
	stackToTree(e) {
		return e.close(), M.build({
			buffer: ke.create(e),
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
		let t = (Le ||= /* @__PURE__ */ new WeakMap()).get(e);
		return t || Le.set(e, t = String.fromCodePoint(this.nextStackID++)), t + e;
	}
};
function He(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (r.pos == e.pos && r.sameState(e)) {
			t[n].score < e.score && (t[n] = e);
			return;
		}
	}
	t.push(e);
}
var Ue = class {
	constructor(e, t, n) {
		this.source = e, this.flags = t, this.disabled = n;
	}
	allows(e) {
		return !this.disabled || this.disabled[e] == 0;
	}
}, We = class e extends we {
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
			typeof e == "string" && (e = O[e]);
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
		this.nodeSet = new ae(t.map((t, i) => A.define({
			name: i >= this.minRepeatTerm ? void 0 : t,
			id: i,
			props: r[i],
			top: n.indexOf(i) > -1,
			error: i == 0,
			skipped: e.skippedNodes && e.skippedNodes.indexOf(i) > -1
		}))), e.propSources && (this.nodeSet = this.nodeSet.extend(...e.propSources)), this.strict = !1, this.bufferLength = D;
		let a = I(e.tokenData);
		this.context = e.context, this.specializerSpecs = e.specialized || [], this.specialized = new Uint16Array(this.specializerSpecs.length);
		for (let e = 0; e < this.specializerSpecs.length; e++) this.specialized[e] = this.specializerSpecs[e].term;
		this.specializers = this.specializerSpecs.map(Ke), this.states = I(e.states, Uint32Array), this.data = I(e.stateData), this.goto = I(e.goto), this.maxTerm = e.maxTerm, this.tokenizers = e.tokenizers.map((e) => typeof e == "number" ? new L(a, e) : e), this.topRules = e.topRules, this.dialects = e.dialects || {}, this.dynamicPrecedences = e.dynamicPrecedences || null, this.tokenPrecTable = e.tokenPrec, this.termNames = e.termNames || null, this.maxNode = this.nodeSet.types.length - 1, this.dialect = this.parseDialect(), this.top = this.topRules[Object.keys(this.topRules)[0]];
	}
	createParse(e, t, n) {
		let r = new Ve(this, e, t, n);
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
				if (n[i + 1] == 1) a = n[i = z(n, i + 2)];
				else if (n[i + 1] == 2) return z(n, i + 2);
				else break;
			}
			if (a == t || a == 0) return z(n, i + 1);
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
				if (this.data[n + 1] == 1) n = z(this.data, n + 2);
				else break;
			}
			r = t(z(this.data, n + 1));
		}
		return r;
	}
	nextStates(e) {
		let t = [];
		for (let n = this.stateSlot(e, 1);; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = z(this.data, n + 2);
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
			return n.specializers[r] = Ke(a), a;
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
		return new Ue(e, n, r);
	}
	static deserialize(t) {
		return new e(t);
	}
};
function z(e, t) {
	return e[t] | e[t + 1] << 16;
}
function Ge(e) {
	let t = null;
	for (let n of e) {
		let e = n.p.stoppedAt;
		(n.pos == n.p.stream.end || e != null && n.pos > e) && n.p.parser.stateFlag(n.state, 2) && (!t || t.score < n.score) && (t = n);
	}
	return t;
}
function Ke(e) {
	if (e.external) {
		let t = +!!e.extend;
		return (n, r) => e.external(n, r) << 1 | t;
	}
	return e.get;
}
// src/dsl/grammar/dav.grammar
var qe = {
	__proto__: null,
	dav: 10,
	title: 16,
	group: 22,
	desc: 36,
	true: 44,
	false: 46,
	node: 58,
	step: 68,
	focus: 76,
	state: 80,
	animate: 84,
	code: 91
}, Je = We.deserialize({
	version: 14,
	states: ".WQkQPOOOrQPO'#CzOOQO'#Dg'#DgOOQO'#D^'#D^QYQPOOQYQPOOOwQPO'#C_O|QPO'#CcO!RQPO'#CxO!WQPO'#CfO!]QPO'#C}O!bQPO,59fOOQO-E7[-E7[OOQO,58y,58yOOQO,58},58}O!gQPO,59dO#UQPO,59QO#aQPO,59iO#fQPO1G/QOOQO'#Ch'#ChO$QQPO'#CkOOQO1G/O1G/OO$]QPO1G/OO$wQPO'#CwOOQO1G.l1G.lO#[QPO1G.lO#XQPO1G.lO%SQPO'#DPOOQO1G/T1G/TO%eQPO'#C|OOQO7+$l7+$lO%jQPO7+$lOOQO'#Cm'#CmO&RQPO'#ClOOQO,59V,59VO&WQPO,59VOOQO7+$j7+$jOOQO'#D`'#D`O&`QPO,59cOOQO,59c,59cOOQO7+$W7+$WO#[QPO7+$WOOQO'#Di'#DiOOQO'#Da'#DaO&kQPO,59kOOQO,59k,59kO&|QPO'#DQO'RQPO'#DRO'WQPO'#DTO']QPO'#DVOOQO,59h,59hOOQO<<HW<<HWO'bQPO,59WO'vQPO1G.qO(RQPO1G.qOOQO1G.q1G.qOOQO-E7^-E7^OOQO1G.}1G.}OOQO<<Gr<<GrOOQO-E7_-E7_OOQO1G/V1G/VOOQO,59l,59lO(ZQPO,59mO(oQPO,59oO(tQPO,59qOOQO'#Dh'#DhOOQO1G.r1G.rOOQO'#Cq'#CqOOQO,59y,59yOOQO7+$]7+$]O(yQPO7+$]OOQO-E7]-E7]O)UQPO'#DbO)ZQPO1G/XOOQO1G/Z1G/ZO)oQPO1G/]OOQO<<Gw<<GwP)tQPO'#D_OOQO,59|,59|OOQO-E7`-E7`O)|QPO7+$wO*hQPO'#DXOOQO<<Hc<<HcO*sQPO<<HcO+XQPO<<HcOOQO'#Dc'#DcO+`QPO,59sOOQO,59s,59sO+kQPO'#DYOOQOAN=}AN=}O+yQPOAN=}OOQO-E7a-E7aOOQO1G/_1G/_OOQO'#D['#D[O,_QPO,59tOOQO,59t,59tO,mQPO,59tOOQOG23iG23iOOQO1G/`1G/`O,uQPO1G/`OOQO7+$z7+$z",
	stateData: "-T~O!YOSPOS~OSPOWVOZXOmWOrYO~OTUO~PYOoZO~OU]O~OX^O~OS_O~OS`O~OXaO~OSbO~OXcO^dOSlaWlaZlamlarla!Wlaila~OXcO^dOjgO~OjkO~O^dOcmOSniWniZnimnirni!Wni~OSpO]rObpO~O^dOSliWliZlimlirli!Wliili~OZXOiwOmWO~Ob!OOi}Ov!POx!QOz!RO~OX!SO~O^dOSnqWnqZnqmnqrnq!Wnq~Oc!UO~O]!XOh!VO~OZXOi!ZOmWO~Ob!OOi!^Ov!POx!QOz!RO~OX!_O~OS!`O~OS!aO~OS!bO~OS!cOU!cOX!cOd!cOf!eOg!eO~OSpO]!gObpO~O]!gOh!hO~Oh!jObuaiuavuaxuazua~O^dO~Oo!mO~OSpO]!nObpO~OS!pO~Oh!jObuiiuivuixuizui~OS!rO~OSpObpO~O^dOcmOj!sObyqiyqvyqxyqzyq~Ob!OOi!yO}!zO~Oj!sObyyiyyvyyxyyzyy~O^dO~P*sOb!OOi#OO}!zO~OS#POT#POX#QO!P#RO~Oj!sOby!Riy!Rvy!Rxy!Rzy!R~O!P#UOb|ai|a}|a~OX#VO!P#UO~O!P#WOb|ii|i}|i~O",
	goto: "%u!^PPP!_PPP!bPP!gP!pPP!v#c#kPPP#qPPPPP#t!gP!bP$O!bP$U$X$aP$aP$aP$e$]P$oP$r$y%P%V%]%cPPP%i%n%qRTOVQOSTUQOSTTugvQf_Rj`Qe_Qi`QnbQtfQyjQ!ToQ!l!aQ!u!rR!|!vQsdV!f!V!h!oXqd!V!h!oR!c!UQh`SxijR![yQobR!v!rRlaSzk|T!w!s!xTzk|Q!t!rS!{!u!vR#T!|R#S!zSSOTR[SQ!WsR!i!WQvgR!YvQ|kR!]|Q!k!`R!q!kQ!x!sR!}!xVROSTR!d!UT{k|",
	nodeNames: "⚠ LineComment Document Header Identifier dav Number Title title String Group group Label ] [ Attributes Attribute AttrName desc : Color Boolean true false , } { GroupBody Node node Edge Arrow EdgeLabel Step step StepBody Desc Focus focus State state Animate animate AnimateBody Code code CodeLang CodeFence",
	maxTerm: 59,
	nodeProps: [[
		"openedBy",
		13,
		"[",
		25,
		"{"
	], [
		"closedBy",
		14,
		"]",
		26,
		"}"
	]],
	skippedNodes: [0, 1],
	repeatNodeCount: 6,
	tokenData: "*h~RkX^!vpq!vrs#kst%_|}%y}!O&O!O!P&}!P!Q'T!Q![&d![!]'r!^!_'w!c!}(Q!}#O(c#P#Q(h#R#S(Q#S#T(m#T#o(Q#o#p*^#q#r*c#y#z!v$f$g!v#BY#BZ!v$IS$I_!v$I|$JO!v$JT$JU!v$KV$KW!v&FU&FV!v~!{Y!Y~X^!vpq!v#y#z!v$f$g!v#BY#BZ!v$IS$I_!v$I|$JO!v$JT$JU!v$KV$KW!v&FU&FV!v~#nWOY#kZr#krs$Ws#O#k#O#P$]#P;'S#k;'S;=`%X<%lO#k~$]OX~~$`RO;'S#k;'S;=`$i;=`O#k~$lXOY#kZr#krs$Ws#O#k#O#P$]#P;'S#k;'S;=`%X;=`<%l#k<%lO#k~%[P;=`<%l#k~%bR!Q![%k!c!}%k#T#o%k~%pRd~!Q![%k!c!}%k#T#o%k~&OOh~~&RQ}!O&X!Q![&d~&[P!`!a&_~&dOo~~&iQU~!O!P&o!Q![&d~&rP!Q![&u~&zPU~!Q![&u~'QP!O!P&X~'WP!P!Q'Z~'`SP~OY'ZZ;'S'Z;'S;=`'l<%lO'Z~'oP;=`<%l'Z~'wOc~~'zQ}!O&X!O!P&X~(VSS~!Q![(Q!c!}(Q#R#S(Q#T#o(Q~(hO^~~(mO]~~(pP#S#T(s~(vP#S#T(y~(|TO#S(y#S#T)]#T;'S(y;'S;=`*W<%lO(y~)`TO#S(y#S#T)o#T;'S(y;'S;=`*W<%lO(y~)rTO#S(y#S#T*R#T;'S(y;'S;=`*W<%lO(y~*WO!P~~*ZP;=`<%l(y~*cOj~~*hOi~",
	tokenizers: [0],
	topRules: { Document: [0, 2] },
	specialized: [{
		term: 4,
		get: (e) => qe[e] || -1
	}],
	tokenPrec: 0
}), Ye = /* @__PURE__ */ new Set([
	"String",
	"Number",
	"Color",
	"Identifier",
	"Boolean"
]);
function Xe(e) {
	return Je.parse(e);
}
function B(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) t.push(n);
	return t;
}
function Ze(e) {
	for (let t = e.firstChild; t; t = t.nextSibling) if (Ye.has(t.name)) return t;
	return null;
}
function V(e, t) {
	return e.slice(t.from, t.to);
}
function Qe(e) {
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
function $e(e) {
	let t = e.startsWith("```"), n = e.length >= (t ? 6 : 3) && e.endsWith("```");
	return T(e.slice(t ? 3 : 0, n ? -3 : void 0));
}
// src/dsl/attributes.ts
var et = {
	string: "\"...\"",
	bool: "true | false",
	color: i.join(" | "),
	stateColor: [...i, o].join(" | "),
	icon: n.join(" | "),
	ident: "identifier"
};
function tt(e, t, n) {
	let { value: r, invalid: i } = Qe(V(e, t));
	for (let e of i) {
		let r = t.from + e.offset;
		n("invalid-escape", "error", {
			from: r,
			to: r + e.sequence.length
		}, { sequence: e.sequence });
	}
	return r;
}
function nt(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	if (t) {
		let a = l[n], o = /* @__PURE__ */ new Set();
		for (let s of t.getChildren("Attribute")) {
			let t = s.getChild("AttrName"), c = Ze(s);
			if (!t || !c) continue;
			let l = V(e, t), u = Object.hasOwn(a, l) ? a[l] : void 0;
			if (!u) {
				r("unknown-attribute", "warning", t, {
					name: l,
					owner: n
				});
				continue;
			}
			o.has(l) && r("duplicate-attribute", "warning", t, { name: l }), o.add(l);
			let d = rt(e, l, u, c, r);
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
function rt(e, t, n, r, i) {
	let a = V(e, r), o = () => {
		i("invalid-attribute-value", "error", r, {
			name: t,
			expected: et[n]
		});
	};
	switch (n) {
		case "string": return r.name === "String" ? tt(e, r, i) : o();
		case "bool": return r.name === "Boolean" ? a === "true" : o();
		case "ident": return r.name === "Identifier" ? a : o();
		case "color":
		case "stateColor": return r.name !== "Identifier" && r.name !== "Color" ? o() : it(a, r, n === "stateColor", i);
		case "icon": return r.name === "Identifier" ? at(a, r, i) : o();
	}
}
function it(e, t, n, r) {
	let s = e.toLowerCase();
	if (a(s)) return s;
	if (n && s === "none") return o;
	r("invalid-color", "error", t, {
		value: e,
		suggestion: (t.name === "Color" ? void 0 : p(e, i)) ?? "",
		names: (n ? [...i, o] : i).join(", ")
	});
}
function at(e, t, i) {
	let a = e.toLowerCase();
	if (r(a)) return a;
	i("unknown-icon", "error", t, {
		icon: e,
		suggestion: p(e, n) ?? ""
	});
}
// src/dsl/sourceMap.ts
function H(e) {
	return {
		from: e.from,
		to: e.to
	};
}
// src/dsl/analyze.ts
var ot = {
	style: "solid",
	direction: "forward"
};
function st(e) {
	return new ct(e).run();
}
var ct = class {
	text;
	diagnostics = [];
	elements = /* @__PURE__ */ new Map();
	stepRanges = [];
	references = [];
	stateChecks = [];
	doc = {
		version: 1,
		title: "",
		groups: [],
		nodes: [],
		edges: [],
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
		let e = Xe(this.text).topNode;
		this.collectSyntaxErrors(e);
		let t = e.getChild("Header");
		t ? this.readHeader(t) : this.report("missing-header", "error", {
			from: 0,
			to: 0
		});
		for (let t of B(e)) switch (t.name) {
			case "Title":
				this.readTitle(t);
				break;
			case "Group":
				this.readGroup(t, void 0);
				break;
			case "Node":
				this.readNode(t, void 0);
				break;
			case "Edge":
				this.readEdge(t);
				break;
			case "Step": this.readStep(t);
		}
		return this.resolveReferences(), this.diagnostics.sort((e, t) => e.from - t.from || e.to - t.to), {
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
			if (t.add(n.from), n.from >= this.text.trimEnd().length) {
				if (t.size > 1) continue;
				let e = this.text.length;
				this.report("unexpected-eof", "error", {
					from: e,
					to: e
				});
				continue;
			}
			let e = n.to > n.from ? V(this.text, n) : /^\S+/.exec(this.text.slice(n.from))?.[0] ?? "", r = e.length > 24 ? `${e.slice(0, 24)}…` : e;
			this.report("syntax-error", "error", {
				from: n.from,
				to: Math.max(n.to, n.from + e.length)
			}, { token: r.split("\n")[0] ?? "" });
		} while (n.next());
	}
	readHeader(e) {
		let t = e.getChild("Number");
		if (!t) return;
		let n = V(this.text, t);
		this.doc.version = Number(n), n !== "1" && this.report("unsupported-version", "error", t, { version: n });
	}
	readTitle(e) {
		let t = e.getChild("String");
		t && (this.titleSeen && this.report("duplicate-title", "warning", e), this.titleSeen = !0, this.doc.title = this.readString(t));
	}
	readGroup(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = V(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "group"), a = {
			id: r,
			label: this.readChildString(e, "Label") ?? r
		};
		t && (a.parentId = t);
		let o = i.value("color");
		o !== void 0 && (a.color = o);
		let s = this.declare({
			kind: "group",
			id: r,
			from: e.from,
			to: e.to,
			idRange: H(n)
		});
		s && this.doc.groups.push(a);
		let c = e.getChild("GroupBody");
		if (!c) return;
		let l = s ? r : t;
		for (let e of B(c)) e.name === "Group" ? this.readGroup(e, l) : e.name === "Node" && this.readNode(e, l);
	}
	readNode(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = V(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "node"), a = {
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
		c !== void 0 && (a.color = c), this.declare({
			kind: "node",
			id: r,
			from: e.from,
			to: e.to,
			idRange: H(n)
		}) && this.doc.nodes.push(a);
	}
	readEdge(e) {
		let t = e.getChildren("Identifier"), n = e.getChild("Arrow"), [r, i] = t;
		if (!r || !i || !n) return;
		let a = V(this.text, r), o = V(this.text, i), s = V(this.text, n), l = f[s] ?? ot;
		a === o && l.direction === "bidirectional" && this.report("invalid-self-arrow", "error", n, {
			arrow: s,
			suggestion: l.style === "dashed" ? "..>" : "-->"
		});
		let u = this.readAttributes(e.getChild("Attributes"), "edge"), d = u.get("id"), p = {
			id: d?.value ?? c(a, o),
			explicitId: d !== void 0,
			from: a,
			to: o,
			style: l.style,
			direction: l.direction,
			visible: u.value("visible") ?? !0
		}, m = this.readChildString(e, "EdgeLabel");
		m !== void 0 && (p.label = m);
		let h = u.value("color");
		h !== void 0 && (p.color = h), d ? this.declare({
			kind: "edge",
			id: p.id,
			from: e.from,
			to: e.to,
			idRange: H(d.node)
		}) : this.elements.has(p.id) ? this.report("duplicate-edge", "error", e, {
			from: a,
			to: o
		}) : this.elements.set(p.id, {
			kind: "edge",
			id: p.id,
			from: e.from,
			to: e.to
		}), this.references.push({
			id: a,
			range: H(r),
			allowed: ["node"]
		}, {
			id: o,
			range: H(i),
			allowed: ["node"]
		}), this.doc.edges.push(p);
	}
	readStep(e) {
		let t = {
			index: this.doc.steps.length,
			title: this.readChildString(e) ?? "",
			description: "",
			focus: [],
			states: [],
			animations: []
		}, n = e.getChild("StepBody");
		for (let e of n ? B(n) : []) switch (e.name) {
			case "Focus":
				for (let n of e.getChildren("Identifier")) {
					let e = V(this.text, n);
					t.focus.push(e), this.references.push({
						id: e,
						range: H(n),
						allowed: ["node", "group"]
					});
				}
				break;
			case "State":
				this.readState(e, t);
				break;
			case "Animate": this.readAnimate(e, t);
		}
		t.description = this.readDescList(n).join("\n"), this.stepRanges.push({
			from: e.from,
			to: e.to
		}), this.doc.steps.push(t);
	}
	readState(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = V(this.text, n), i = e.getChild("Attributes"), a = this.readAttributes(i, "state");
		i && i.getChildren("Attribute").length === 0 && this.report("empty-state", "warning", e);
		let o = { target: r }, s = a.value("visible");
		s !== void 0 && (o.visible = s);
		let c = a.value("badge");
		c !== void 0 && (o.badge = c);
		let l = a.value("color");
		l !== void 0 && (o.color = l), t.states.push(o), this.references.push({
			id: r,
			range: H(n),
			allowed: [
				"node",
				"group",
				"edge"
			]
		}), this.stateChecks.push({
			target: r,
			attrs: a.entries
		});
	}
	readAnimate(e, t) {
		let [n, r] = e.getChildren("Identifier"), i = e.getChild("Arrow");
		if (!n || !r || !i) return;
		let a = V(this.text, i), o = f[a] ?? ot;
		o.style === "dashed" ? this.report("invalid-animate-arrow", "error", i, {
			arrow: a,
			suggestion: o.direction === "bidirectional" ? "<->" : "-->"
		}) : o.direction === "bidirectional" && V(this.text, n) === V(this.text, r) && this.report("invalid-self-arrow", "error", i, {
			arrow: a,
			suggestion: "-->"
		});
		let s = this.readAttributes(e.getChild("Attributes"), "animate"), c = {
			from: V(this.text, n),
			to: V(this.text, r),
			direction: o.direction,
			parallel: s.value("parallel") ?? !1
		}, l = this.readChildString(e, "EdgeLabel");
		l !== void 0 && (c.label = l);
		let u = s.value("color");
		u !== void 0 && (c.color = u);
		let d = s.value("icon");
		d !== void 0 && (c.icon = d);
		let p = [], m = s.value("desc");
		m !== void 0 && m.length > 0 && p.push(m);
		let h = e.getChild("AnimateBody");
		p.push(...this.readDescList(h)), p.length > 0 && (c.description = p.join("\n"));
		let g = !1, _, v = s.get("code");
		if (v !== void 0 && (g = !0, v.value.trim().length > 0 && (_ = { body: v.value })), h) for (let e of B(h)) {
			if (e.name !== "Code") continue;
			g && this.report("duplicate-code", "warning", e), g = !0;
			let t = this.readCode(e);
			t !== void 0 && (_ = t);
		}
		_ !== void 0 && (c.code = _), t.animations.push(c), this.references.push({
			id: c.from,
			range: H(n),
			allowed: ["node"]
		}, {
			id: c.to,
			range: H(r),
			allowed: ["node"]
		});
	}
	readCode(e) {
		let t = e.getChild("CodeLang"), n = e.getChild("String"), r = e.getChild("CodeFence"), i, a;
		if (r ? (n && (i = this.readString(n)), a = $e(V(this.text, r))) : n && (a = this.readString(n)), a === void 0 || a.trim().length === 0) return;
		let o = { body: a };
		return t && (o.lang = V(this.text, t)), i !== void 0 && (o.title = i), o;
	}
	readString(e) {
		return tt(this.text, e, this.reportFn);
	}
	readChildString(e, t) {
		let n = (t ? e.getChild(t) : e)?.getChild("String");
		return n ? this.readString(n) : void 0;
	}
	readDescList(e) {
		if (!e) return [];
		let t = [];
		for (let n of B(e)) if (n.name === "Desc") {
			let e = this.readChildString(n);
			e !== void 0 && t.push(e);
		}
		return t;
	}
	readAttributes(e, t) {
		return nt(this.text, e, t, this.reportFn);
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
			let n = u[t.kind];
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
}, lt = d.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
new RegExp(lt), RegExp(`(?:${lt})\\s*\\w*$`), RegExp(`${lt}|^\\s*animate\\b`);
// src/dsl/diagnostics.ts
var ut = {
	ja: {
		"syntax-error": "構文エラー: \"{token}\" は解釈できません",
		"unexpected-eof": "入力が途中で終わっています（\"}\" や \"]\" の閉じ忘れの可能性があります）",
		"missing-header": "先頭に \"dav 1\" が必要です",
		"unsupported-version": "DSL バージョン {version} には対応していません（対応: 1）",
		"duplicate-title": "title は1回だけ指定できます",
		"duplicate-id": "ID \"{id}\" は既に使われています",
		"duplicate-edge": "\"{from}\" から \"{to}\" へのエッジが重複しています。2本目以降は [id: ...] を指定してください",
		"undefined-reference": "\"{id}\" は定義されていません",
		"reference-kind-mismatch": "\"{id}\" は{actual}です（{expected}を指定してください）",
		"unknown-attribute": "属性 \"{name}\" は{owner}では使えません",
		"duplicate-attribute": "属性 \"{name}\" が重複しています（後の値が使われます）",
		"invalid-attribute-value": "属性 \"{name}\" の値が不正です（期待: {expected}）",
		"unknown-icon": "アイコン \"{icon}\" は存在しません{suggestion}",
		"invalid-color": "色 \"{value}\" は不正です{suggestion}（使用可: {names}）",
		"invalid-animate-arrow": "animate では点線の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-self-arrow": "自己ループに双方向の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-escape": "エスケープシーケンス \"{sequence}\" は使えません（使用可: \\\" \\\\ \\n \\t）",
		"attribute-not-applicable": "属性 \"{name}\" は{kind}には適用されません",
		"empty-state": "state に属性が指定されていません",
		"duplicate-code": "code は1つの animate に1つだけ指定できます（後の値が使われます）"
	},
	en: {
		"syntax-error": "Syntax error: unexpected \"{token}\"",
		"unexpected-eof": "Unexpected end of input (a closing \"}\" or \"]\" may be missing)",
		"missing-header": "The document must start with \"dav 1\"",
		"unsupported-version": "DSL version {version} is not supported (supported: 1)",
		"duplicate-title": "title can only be specified once",
		"duplicate-id": "ID \"{id}\" is already in use",
		"duplicate-edge": "Duplicate edge from \"{from}\" to \"{to}\". Specify [id: ...] for additional edges",
		"undefined-reference": "\"{id}\" is not defined",
		"reference-kind-mismatch": "\"{id}\" is a {actual} (expected {expected})",
		"unknown-attribute": "Attribute \"{name}\" is not allowed on {owner}",
		"duplicate-attribute": "Duplicate attribute \"{name}\" (the last value wins)",
		"invalid-attribute-value": "Invalid value for attribute \"{name}\" (expected {expected})",
		"unknown-icon": "Unknown icon \"{icon}\"{suggestion}",
		"invalid-color": "Invalid color \"{value}\"{suggestion}. Use one of: {names}",
		"invalid-animate-arrow": "Dashed arrow \"{arrow}\" cannot be used in animate{suggestion}",
		"invalid-self-arrow": "Bidirectional arrow \"{arrow}\" cannot form a self-loop{suggestion}",
		"invalid-escape": "Invalid escape sequence \"{sequence}\" (allowed: \\\" \\\\ \\n \\t)",
		"attribute-not-applicable": "Attribute \"{name}\" does not apply to a {kind}",
		"empty-state": "state has no attributes",
		"duplicate-code": "Only one code block is allowed per animate (the last value wins)"
	}
}, dt = {
	ja: {
		node: "ノード",
		group: "グループ",
		edge: "エッジ",
		state: "state",
		animate: "animate"
	},
	en: {
		node: "node",
		group: "group",
		edge: "edge",
		state: "state",
		animate: "animate"
	}
}, ft = {
	ja: "（もしかして \"{value}\"？）",
	en: " (did you mean \"{value}\"?)"
}, pt = /* @__PURE__ */ new Set([
	"owner",
	"kind",
	"actual",
	"expected"
]);
function mt(e, t = "en") {
	return ut[t][e.code].replace(/\{(\w+)\}/g, (n, r) => {
		let i = e.args[r] ?? "";
		return r === "suggestion" ? i ? ft[t].replace("{value}", i) : "" : pt.has(r) ? i.split(/\s*\|\s*/).map((e) => dt[t][e] ?? e).join(t === "ja" ? "・" : " or ") : i;
	});
}
// src/dsl/format.ts
var ht = "  ", gt = /* @__PURE__ */ new Set([
	"GroupBody",
	"StepBody",
	"AnimateBody"
]), _t = {
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
}, vt = /* @__PURE__ */ new Set([
	"Header",
	"Title",
	"Group",
	"Node",
	"Edge",
	"Step",
	"Desc",
	"Focus",
	"State",
	"Animate",
	"Code"
]);
function yt(e) {
	let t = Xe(e), n = !1;
	if (t.iterate({ enter: (e) => (e.type.isError && (n = !0), !n) }), n) return e;
	let r = [];
	new bt(e, r).block(t.topNode, 0);
	let i = e.includes("\r\n") ? "\r\n" : "\n";
	return r.length > 0 ? `${r.join(i)}${i}` : "";
}
var bt = class {
	text;
	lines;
	constructor(e, t) {
		this.text = e, this.lines = t;
	}
	block(e, t) {
		let n = ht.repeat(t), r = -1, i = !0;
		for (let a of B(e)) {
			let e = a.name === "LineComment";
			if (!e && !vt.has(a.name)) continue;
			let o = St(r >= 0 ? this.text.slice(r, a.from) : "");
			e && r >= 0 && o === 0 ? this.appendToLastLine(` ${V(this.text, a).trimEnd()}`) : (!i && o >= 2 && this.lines.push(""), e ? this.lines.push(n + V(this.text, a).trimEnd()) : this.statement(a, t)), r = a.to, i = !1;
		}
	}
	statement(e, t) {
		let n = ht.repeat(t);
		if (xt(e)) {
			e.name === "Code" ? this.verbatimCode(e, n) : this.verbatim(e, n);
			return;
		}
		if (e.name === "Code") {
			this.code(e, n);
			return;
		}
		let r = Object.hasOwn(_t, e.name) ? _t[e.name] : void 0;
		if (r) {
			let i = e.getChild(r.body), a = this.inline(e, (e) => !gt.has(e.name)), o = i !== null && B(i).some((e) => e.name !== "{" && e.name !== "}");
			if (!i || !o) {
				this.lines.push(`${n}${a}${r.emptySuffix}`);
				return;
			}
			this.lines.push(`${n}${a} {`), this.block(i, t + 1), this.lines.push(`${n}}`);
		} else this.lines.push(n + this.inline(e, () => !0));
	}
	inline(e, t) {
		let n = [];
		for (let r of B(e)) if (t(r)) switch (r.name) {
			case "Attributes":
				n.push(this.attributes(r));
				break;
			case "EdgeLabel": {
				let e = r.getChild("String");
				n.push(`: ${e ? V(this.text, e) : "\"\""}`);
				break;
			}
			case "Label":
				n.push(V(this.text, r));
				break;
			case ",": {
				let e = n[n.length - 1];
				e !== void 0 && (n[n.length - 1] = `${e},`);
				break;
			}
			default: n.push(V(this.text, r));
		}
		return n.join(" ");
	}
	attributes(e) {
		return `[${e.getChildren("Attribute").map((e) => {
			let t = e.getChild("AttrName"), n = Ze(e);
			return `${t ? V(this.text, t) : ""}: ${n ? V(this.text, n) : ""}`;
		}).join(", ")}]`;
	}
	code(e, t) {
		let n = e.getChild("CodeLang"), r = e.getChild("String"), i = e.getChild("CodeFence"), a = ["code"];
		n && a.push(V(this.text, n)), r && a.push(V(this.text, r)), i ? (a.push("```"), this.lines.push(`${t}${a.join(" ")}`), this.fenceBody(i, t)) : this.lines.push(`${t}${a.join(" ")}`);
	}
	verbatimCode(e, t) {
		let n = e.getChild("CodeFence");
		if (!n) {
			this.verbatim(e, t);
			return;
		}
		let r = V(this.text, {
			from: e.from,
			to: n.from
		}).replace(/[ \t]*$/, ""), i = r.endsWith("\n"), a = i ? r.replace(/\r?\n$/, "") : r;
		this.verbatimSpan(a, e.from, t), i ? this.lines.push(`${t}\`\`\``) : this.appendToLastLine(" ```"), this.fenceBody(n, t);
	}
	fenceBody(e, t) {
		let n = $e(V(this.text, e));
		if (n.length > 0) for (let e of n.split("\n")) this.lines.push(e.length > 0 ? `${t}  ${e}` : "");
		this.lines.push(`${t}\`\`\``);
	}
	verbatim(e, t) {
		this.verbatimSpan(V(this.text, e), e.from, t);
	}
	verbatimSpan(e, t, n) {
		let r = e.split(/\r?\n/), i = Ct(this.lineAt(t));
		r.forEach((e, t) => {
			if (t === 0) this.lines.push(n + e.trimEnd());
			else {
				let t = e.startsWith(i) ? e.slice(i.length) : e.trimStart();
				this.lines.push(n + t.trimEnd());
			}
		});
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
function xt(e) {
	for (let t of B(e)) if (t.name === "LineComment" || !gt.has(t.name) && xt(t)) return !0;
	return !1;
}
function St(e) {
	let t = 0;
	for (let n of e) n === "\n" && t++;
	return t;
}
function Ct(e) {
	return /^\s*/.exec(e)?.[0] ?? "";
}
// src/model/zones.ts
function wt(e) {
	return new Map(e.map((e) => [e.id, e.parentId]));
}
function Tt(e) {
	return e.filter((e) => e.parentId === void 0);
}
function Et(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n.id, n.parentId === void 0 ? n.id : t.get(n.parentId) ?? n.id);
	return t;
}
function Dt(e) {
	let t = Et(e.groups);
	return new Map(e.nodes.map((e) => [e.id, e.parentId === void 0 ? void 0 : t.get(e.parentId) ?? e.parentId]));
}
function Ot(e, t) {
	let n = [];
	for (let r = t; r !== void 0; r = e.get(r)) n.push(r);
	return n;
}
var kt = (e, t) => `${e}\u0000${t}`, U = {
	width: 176,
	height: 118
}, W = {
	x: 40,
	y: 40
}, G = {
	width: 160,
	height: 40
}, At = 30, jt = 18;
function Mt(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.edges) n.from === n.to && t.set(n.from, (t.get(n.from) ?? 0) + 1);
	return new Map([...t].map(([e, t]) => [e, At + (t - 1) * jt]));
}
function K() {
	return Object.create(null);
}
function Nt(e) {
	let t = e[0];
	if (!t) return {
		...W,
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
// src/layout/links.ts
function Pt(e) {
	let t = new Set(e.nodes.map((e) => e.id));
	return e.edges.filter((e) => e.from !== e.to && t.has(e.from) && t.has(e.to)).map((e) => [e.from, e.to]);
}
function Ft(e, t) {
	return e.flatMap(([e, n]) => {
		let r = t.nodes[e], i = t.nodes[n];
		return !r || !i ? [] : [{
			from: e,
			to: n,
			ax: r.x + r.width / 2,
			ay: r.y + 50,
			bx: i.x + i.width / 2,
			by: i.y + 50
		}];
	});
}
function It(e, t, n, r, i, a) {
	return Math.sign((n - e) * (a - t) - (r - t) * (i - e));
}
function Lt(e, t) {
	return e.from === t.from || e.from === t.to || e.to === t.from || e.to === t.to;
}
function Rt(e, t) {
	return It(e.ax, e.ay, e.bx, e.by, t.ax, t.ay) * It(e.ax, e.ay, e.bx, e.by, t.bx, t.by) < 0 && It(t.ax, t.ay, t.bx, t.by, e.ax, e.ay) * It(t.ax, t.ay, t.bx, t.by, e.bx, e.by) < 0;
}
function zt(e) {
	let t = 0;
	return e.forEach((n, r) => {
		for (let i = r + 1; i < e.length; i++) {
			let r = e[i];
			r && !Lt(n, r) && Rt(n, r) && t++;
		}
	}), t;
}
function Bt(e, t) {
	return zt(Ft(Pt(e), t));
}
// src/layout/ranks.ts
function Vt(e, t) {
	let n = new Set(e), r = new Map(e.map((e) => [e, []]));
	for (let [e, i] of t) n.has(e) && n.has(i) && e !== i && r.get(e)?.push(i);
	let i = /* @__PURE__ */ new Map(), a = new Map(e.map((e) => [e, []]));
	for (let t of e) {
		if (i.get(t)) continue;
		let e = [{
			id: t,
			i: 0
		}];
		for (i.set(t, 1); e.length > 0;) {
			let t = e[e.length - 1];
			if (!t) break;
			let n = r.get(t.id) ?? [];
			if (t.i >= n.length) {
				i.set(t.id, 2), e.pop();
				continue;
			}
			let o = n[t.i++];
			if (o === void 0) continue;
			let s = i.get(o) ?? 0;
			s !== 1 && (a.get(t.id)?.push(o), s === 0 && (i.set(o, 1), e.push({
				id: o,
				i: 0
			})));
		}
	}
	let o = new Map(e.map((e) => [e, 0]));
	for (let e of a.values()) for (let t of e) o.set(t, (o.get(t) ?? 0) + 1);
	let s = new Map(e.map((e) => [e, 0])), c = e.filter((e) => o.get(e) === 0);
	for (let e = 0; e < c.length; e++) {
		let t = c[e];
		if (t !== void 0) for (let e of a.get(t) ?? []) {
			s.set(e, Math.max(s.get(e) ?? 0, (s.get(t) ?? 0) + 1));
			let n = (o.get(e) ?? 0) - 1;
			o.set(e, n), n === 0 && c.push(e);
		}
	}
	return {
		rank: s,
		predecessors: Ht(a)
	};
}
function Ht(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of e) for (let e of r) E(t, e, n);
	return t;
}
// src/layout/columns.ts
var Ut = 36, Wt = 32, Gt = 14, Kt = 28, qt = 16, Jt = 4, Yt = 500;
function q(e) {
	let t = wt(e.groups), n = wt(e.nodes), r = /* @__PURE__ */ new Map();
	for (let t of e.groups) t.parentId && E(r, t.parentId, t.id);
	let i = /* @__PURE__ */ new Map();
	for (let t of e.nodes) t.parentId && E(i, t.parentId, t.id);
	let a = nn(e, t), o = Math.max(0, ...Mt(e).values()), s = new Map(e.nodes.map((e) => [e.id, o])), c = Vt(e.nodes.map((e) => e.id), e.edges.map((e) => [e.from, e.to])), l = Xt(e, c.rank, a, r, i), u = e.nodes.length > 0 || a.size > 0 ? $t(e, a, c, l, t, n) : void 0, d = Zt(e, c.rank, (e) => {
		let t = K(), n = K();
		return u && tn(u, c, t, n, s, e), {
			nodes: t,
			placeholders: n
		};
	});
	return {
		nodes: d.nodes,
		groups: rn(e, d.nodes, d.placeholders, s, l, r, i)
	};
}
function Xt(e, t, n, r, i) {
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
function Zt(e, t, n) {
	let r = Pt(e), i = n();
	if (r.length === 0 || r.length > Yt) return i;
	let a = (e) => {
		let n = /* @__PURE__ */ new Map(), i = (r, i) => {
			e(t.get(r) ?? 0, t.get(i) ?? 0) && E(n, r, i);
		};
		for (let [e, t] of r) i(e, t), i(t, e);
		return n;
	}, o = a((e, t) => t < e), s = a((e, t) => t > e), c = a(() => !0), l = i, u = Qt(r, l), d = 0;
	for (let e = 0; e < qt && d < Jt; e++) {
		i = n({
			previous: i,
			columnNeighbors: e % 2 == 0 ? o : s,
			linked: c
		});
		let t = Qt(r, i);
		t.crossings < u.crossings || t.crossings === u.crossings && t.length < u.length ? (l = i, u = t, d = 0) : d++;
	}
	return l;
}
function Qt(e, t) {
	let n = Ft(e, t);
	return {
		crossings: zt(n),
		length: n.reduce((e, t) => e + Math.abs(t.ay - t.by), 0)
	};
}
function $t(e, t, n, r, i, a) {
	let o = (e) => ({
		id: e,
		nodes: [],
		children: [],
		allNodes: [],
		colSpan: [0, 0],
		needsLayout: !1
	}), s = /* @__PURE__ */ new Map(), c = o(void 0);
	s.set(void 0, c);
	for (let t of e.groups) s.set(t.id, o(t.id));
	for (let t of e.groups) {
		let e = s.get(t.id);
		e && s.get(t.parentId)?.children.push(e);
	}
	for (let t of e.nodes) s.get(a.get(t.id))?.nodes.push(t.id);
	let l = (e) => n.rank.get(e) ?? 0, u = (e) => {
		let n = e.nodes.map(l);
		e.id !== void 0 && t.has(e.id) && n.push(0);
		let r = [...e.nodes], i = !1;
		for (let t of e.children) n.push(...u(t)), r.push(...t.allNodes), t.needsLayout && (i = !0);
		return e.allNodes = r, e.colSpan = n.length === 0 ? [0, 0] : [Math.min(...n), Math.max(...n)], e.needsLayout = e.nodes.length > 0 || e.id !== void 0 && t.has(e.id) || i, n;
	};
	u(c);
	let d = Math.max(0, ...e.nodes.map((e) => l(e.id))), f = Math.max(0, ...e.groups.map((e) => Ot(i, e.id).length)) * 16, p = (e) => (r.endsAt.has(e) ? 16 : 0) + (r.startsAt.has(e + 1) ? 16 : 0), m = /* @__PURE__ */ new Map();
	for (let t of e.edges) {
		if (!t.label || !n.rank.has(t.from) || !n.rank.has(t.to)) continue;
		let e = Math.min(l(t.from), l(t.to));
		if (Math.abs(l(t.from) - l(t.to)) !== 1) continue;
		let r = Math.min(180, C(t.label, 11));
		m.set(e, Math.max(m.get(e) ?? 0, r + Wt));
	}
	let h = [], g = W.x + f;
	for (let e = 0; e <= d; e++) {
		h.push(g);
		let t = (m.get(e) ?? 0) - (U.width - 44);
		g += U.width + Math.max(Ut, t) + p(e);
	}
	return {
		root: c,
		columnX: h,
		maxRank: d,
		inset: f
	};
}
var en = 34;
function tn(e, t, n, r, i, a) {
	let o = (e) => t.rank.get(e) ?? 0, s = (e) => a?.previous.nodes[e]?.y ?? 0, c = (e) => e.length > 0 ? e.reduce((e, t) => e + s(t), 0) / e.length : void 0, l = (e) => {
		let t = new Set(e), n = e.flatMap((e) => (a?.linked.get(e) ?? []).filter((e) => !t.has(e)));
		return c(n) ?? c(e) ?? Infinity;
	}, u = (e) => {
		if (a) return c(a.columnNeighbors.get(e) ?? []) ?? s(e);
		let r = (t.predecessors.get(e) ?? []).filter((e) => n[e]);
		return r.length > 0 ? r.reduce((e, t) => e + (n[t]?.y ?? 0), 0) / r.length : Infinity;
	}, d = Math.max(0, ...i.values()), f = en + d, p = (e) => Math.max(0, ...e.children.filter((e) => e.needsLayout).map((e) => 1 + p(e))), m = (t, i) => {
		let c = t.id !== void 0, h = p(t), g = i + (c ? 34 : 0) + d, _ = Array.from({ length: e.maxRank + 1 }, () => g), v = g, y = /* @__PURE__ */ new Map();
		for (let e of t.nodes) E(y, o(e), e);
		let b = [], x = 0;
		for (let [e, t] of y.entries()) b.push({
			kind: "col",
			rank: e,
			ids: t,
			minCol: e,
			maxCol: e,
			order: x++
		});
		for (let e of t.children) {
			if (!e.needsLayout) continue;
			let [t, n] = e.colSpan;
			b.push({
				kind: "group",
				child: e,
				minCol: t,
				maxCol: n,
				order: x++
			});
		}
		if (a) {
			let e = new Map(b.map((e) => [e, l(e.kind === "col" ? e.ids : e.child.allNodes)]));
			b.sort((t, n) => (e.get(t) ?? 0) - (e.get(n) ?? 0) || t.order - n.order);
		} else b.sort((e, t) => e.minCol - t.minCol || e.order - t.order);
		for (let t of b) if (t.kind === "col") {
			let { rank: r, ids: i } = t, a = i.map((e, t) => ({
				id: e,
				key: u(e),
				i: t
			}));
			a.sort((e, t) => e.key - t.key || s(e.id) - s(t.id) || e.i - t.i);
			let o = _[r] ?? g;
			o === g && (o += h * f);
			for (let { id: t } of a) n[t] = {
				x: e.columnX[r] ?? W.x,
				y: o,
				...U
			}, o += U.height + Gt + d;
			let c = o - Gt - d;
			_[r] = c + Kt, v = Math.max(v, c);
		} else {
			let { child: e, minCol: n, maxCol: r } = t, i = Math.max(..._.slice(n, r + 1)), a = i === g ? i + (h - 1 - p(e)) * f : i, o = m(e, a);
			for (let e = n; e <= r; e++) _[e] = o + Kt + d;
			v = Math.max(v, o);
		}
		return c && v === g && t.id !== void 0 && (r[t.id] = {
			x: e.columnX[0] ?? W.x,
			y: g,
			...G
		}, v = g + G.height), v + (c ? 16 : 0);
	};
	m(e.root, W.y + e.inset);
}
function nn(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of e.nodes) for (let e of Ot(t, r.parentId)) n.add(e);
	return new Set(e.groups.filter((e) => !n.has(e.id)).map((e) => e.id));
}
function rn(e, t, n, r, i, a, o) {
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
			...W,
			width: 240,
			height: 140
		};
		else {
			let t = Nt(d), n = i.pads.get(e), r = t.x - (n?.left ?? 16), a = t.y - 16 - 18, o = t.x + t.width + (n?.right ?? 16), s = t.y + t.height + 16;
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
// src/layout/zoneBlocks.ts
var an = 2, on = 150, sn = 44;
function cn(e) {
	return Tt(e.groups).length >= an;
}
var J = (e, t) => e < t ? kt(e, t) : kt(t, e);
function ln(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e.steps) for (let e of n.animations) e.direction === "bidirectional" && t.add(J(e.from, e.to));
	return t;
}
function un(e, t) {
	let n = ln(e), r = 0;
	for (let i of Ft(Pt(e), t)) {
		let e = n.has(J(i.from, i.to)) ? 2 : 1;
		r += Math.max(0, Math.hypot(i.ax - i.bx, i.ay - i.by) * e - 700);
	}
	return r;
}
function dn(e) {
	return JSON.stringify([
		e.nodes.map((e) => [e.id, e.parentId ?? ""]),
		e.groups.map((e) => [e.id, e.parentId ?? ""]),
		e.edges.map((e) => [e.from, e.to]),
		[...ln(e)].sort()
	]);
}
function fn(e) {
	return {
		...e,
		edges: e.edges.map(({ label: e, ...t }) => t)
	};
}
function pn(e, t) {
	if (e.parentId !== t) return e;
	let { parentId: n, ...r } = e;
	return r;
}
function mn(e, t) {
	let n = Et(e.groups), r = Dt(e), i = new Map(e.nodes.map((e) => {
		let t = r.get(e.id);
		return [e.id, t !== void 0 && n.has(t) ? t : e.id];
	})), a = [];
	for (let r of Tt(e.groups)) {
		let o = e.nodes.filter((e) => i.get(e.id) === r.id).map((e) => pn(e, r.id)), s = e.groups.filter((e) => e.id !== r.id && n.get(e.id) === r.id).map((e) => pn(e, r.id)), c = new Set(o.map((e) => e.id)), l = e.edges.filter((e) => c.has(e.from) && c.has(e.to)), u = Math.max(0, ...Mt({ edges: l }).values()), d = 34 + u, f = (e, t) => [r.id, {
			x: 0,
			y: 0,
			width: e,
			height: t
		}];
		if (o.length === 0 && s.length === 0) {
			let e = G.width + 32, t = d + G.height + 16;
			a.push({
				id: r.id,
				width: e,
				height: t,
				head: d,
				contentHeight: G.height,
				flippable: !1,
				nodes: /* @__PURE__ */ new Map(),
				groups: new Map([f(e, t)])
			});
			continue;
		}
		let p = t({
			...e,
			nodes: o,
			groups: s,
			edges: l,
			steps: []
		}), m = Nt([...Object.values(p.nodes), ...Object.values(p.groups)]), h = m.width + 32, g = m.height, _ = d + g + 16, v = (e) => ({
			...e,
			x: e.x - m.x + 16,
			y: e.y - m.y + d
		});
		a.push({
			id: r.id,
			width: h,
			height: _,
			head: d,
			contentHeight: g,
			flippable: u === 0 && s.length === 0,
			nodes: new Map(Object.entries(p.nodes).map(([e, t]) => [e, v(t)])),
			groups: new Map([f(h, _), ...Object.entries(p.groups).map(([e, t]) => [e, v(t)])])
		});
	}
	for (let t of e.nodes) {
		if (i.get(t.id) !== t.id) continue;
		let { width: e, height: n } = U;
		a.push({
			id: t.id,
			width: e,
			height: n,
			head: 0,
			contentHeight: n,
			flippable: !1,
			nodes: /* @__PURE__ */ new Map([[t.id, {
				x: 0,
				y: 0,
				width: e,
				height: n
			}]]),
			groups: /* @__PURE__ */ new Map()
		});
	}
	return {
		blocks: a,
		owners: i
	};
}
function hn(e, t, n, r) {
	let i = /* @__PURE__ */ new Set(), a = [];
	for (let t of e.edges) {
		let e = n.get(t.from), r = n.get(t.to);
		e && r && e !== r && !i.has(J(e, r)) && (i.add(J(e, r)), a.push({
			id: `${e}>${r}`,
			explicitId: !1,
			from: e,
			to: r,
			style: "solid",
			direction: "forward",
			visible: !0
		}));
	}
	let o = r({
		...e,
		groups: [],
		edges: a,
		steps: [],
		nodes: t.map((e) => ({
			id: e.id,
			label: "",
			icon: "server",
			visible: !0
		}))
	}), s = (e) => o.nodes[e.id]?.x ?? 0, c = (e) => o.nodes[e.id]?.y ?? 0, l = [...new Set(t.map(s))].sort((e, t) => e - t).map((e) => t.filter((t) => s(t) === e).sort((e, t) => c(e) - c(t))), u = (e) => e.reduce((e, t) => e + t.height, 0) + (e.length - 1) * sn, d = Math.max(...l.map(u)), f = /* @__PURE__ */ new Map(), p = 0;
	for (let e of l) {
		let t = (d - u(e)) / 2;
		for (let n of e) f.set(n.id, {
			x: p,
			y: t
		}), t += n.height + sn;
		p += Math.max(...e.map((e) => e.width)) + on;
	}
	return f;
}
function gn(e, t) {
	return e.head + e.contentHeight - (t.y - e.head) - t.height;
}
function _n(e) {
	let t = [...e].sort((e, t) => e.x - t.x);
	t.forEach((e, n) => {
		for (let r of t.slice(0, n)) e.y < r.y + r.block.height + 34 && r.y < e.y + e.block.height + 34 && (e.x = Math.max(e.x, r.x + r.block.width + 60));
	});
}
function vn(e, t, n) {
	let r = mn(e, n).blocks.map((e) => ({
		block: e,
		...t.get(e.id) ?? {
			x: 0,
			y: 0,
			flip: 0
		}
	}));
	return _n(r), yn(r);
}
function yn(e) {
	let t = Math.min(...e.map((e) => e.x)), n = Math.min(...e.map((e) => e.y)), r = K(), i = K();
	for (let a of e) {
		let e = Math.round(a.x - t + W.x), o = Math.round(a.y - n + W.y), { block: s } = a;
		for (let [t, n] of s.nodes) r[t] = {
			...n,
			x: e + n.x,
			y: o + (a.flip ? gn(s, n) : n.y)
		};
		for (let [t, n] of s.groups) i[t] = {
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
// src/layout/zoneAnneal.ts
var bn = 16e3, xn = [
	11,
	23,
	37,
	53,
	71,
	97
], Sn = 500, Cn = 1.5, wn = 1.6, Tn = [
	128,
	64,
	32,
	16,
	8,
	4
], En = 140, Dn = 30, On = 160, kn = 2, An = 120, jn = 120;
function Mn(e) {
	let t = e;
	return () => {
		t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function Nn(e, t) {
	let n = t.x + t.block.width, r = t.y + t.block.height;
	if (e.maxX <= t.x || e.minX >= n || e.maxY <= t.y || e.minY >= r) return !1;
	let i = e.bx - e.ax, a = e.by - e.ay;
	for (let o = 1; o < 7; o++) {
		let s = e.ax + i * o / 7, c = e.ay + a * o / 7;
		if (s > t.x && s < n && c > t.y && c < r) return !0;
	}
	return !1;
}
function Pn(e) {
	e.ax = e.source.x + e.sourceX, e.ay = e.source.y + e.sourceY[e.source.flip], e.bx = e.target.x + e.targetX, e.by = e.target.y + e.targetY[e.target.flip], e.minX = Math.min(e.ax, e.bx), e.maxX = Math.max(e.ax, e.bx), e.minY = Math.min(e.ay, e.by), e.maxY = Math.max(e.ay, e.by);
}
function Fn(e) {
	let t = e.open[e.source.flip * 2 + e.target.flip], n = e.bx - e.ax, r = e.by - e.ay, i = On;
	return (t & 1 && n > 0 || t & 2 && n < 0) && (i = Math.min(i, Math.abs(r))), (t & 4 && r > 0 || t & 8 && r < 0) && (i = Math.min(i, Math.abs(n))), i;
}
function In(e) {
	let t = e.bx - e.ax, n = Math.hypot(t, e.by - e.ay);
	return Fn(e) * kn + n * e.weight + Math.max(0, n * e.weight - 700) + (t < -60 ? 260 - t * .3 : 0);
}
function Ln(e, t) {
	return e.maxX < t.minX || t.maxX < e.minX || e.maxY < t.minY || t.maxY < e.minY ? 0 : !Lt(e, t) && Rt(e, t) ? 250 : 0;
}
function Rn(e, t) {
	let n = 0;
	for (let r of t) r !== e.source && r !== e.target && Nn(e, r) && (n += 130);
	return n;
}
function zn(e) {
	let t = Infinity, n = -Infinity, r = Infinity, i = -Infinity;
	for (let a of e) t = Math.min(t, a.x), n = Math.max(n, a.x + a.block.width), r = Math.min(r, a.y), i = Math.max(i, a.y + a.block.height);
	return Math.max(n - t, (i - r) * wn) * 1.2;
}
function Bn(e, t) {
	let n = zn(t);
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		if (i) {
			Pn(i), n += In(i) + Rn(i, t);
			for (let t = 0; t < r; t++) {
				let r = e[t];
				r && (n += Ln(i, r));
			}
		}
	}
	return n;
}
var Vn = (e, t, n) => e.source === t || e.target === t || e.source === n || e.target === n;
function Hn(e, t, n, r, i) {
	let a = zn(t);
	for (let t = 0; t < e.length; t++) {
		let o = e[t];
		o && (Vn(o, n, r) ? i && Pn(o) : (Nn(o, n) && (a += 130), r && Nn(o, r) && (a += 130)));
	}
	for (let i = 0; i < e.length; i++) {
		let o = e[i];
		if (o && Vn(o, n, r)) {
			a += In(o) + Rn(o, t);
			for (let t = 0; t < e.length; t++) {
				let s = e[t];
				s && t !== i && (t > i || !Vn(s, n, r)) && (a += Ln(o, s));
			}
		}
	}
	return a;
}
function Un(e, t) {
	for (let n of t) if (n !== e && e.x < n.x + n.block.width + 60 && n.x < e.x + e.block.width + 60 && e.y < n.y + n.block.height + 34 && n.y < e.y + e.block.height + 34) return !1;
	return !0;
}
function Wn(e, t) {
	e.x = t.x, e.y = t.y, e.flip = t.flip;
}
function Y(e, t, n) {
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		i && Vn(i, t, n) && Pn(i);
	}
}
function Gn(e, t, n, r, i, a, o, s = 0, c = 0, l = 0) {
	let u = n.x, d = n.y, f = n.flip, p = o ? o.x : 0, m = o ? o.y : 0, h = o ? o.flip : 0;
	n.x = r, n.y = i, n.flip = a, o && (o.x = s, o.y = c, o.flip = l);
	let g = Un(n, t) && (!o || Un(o, t));
	if (n.x = u, n.y = d, n.flip = f, o && (o.x = p, o.y = m, o.flip = h), !g) return NaN;
	let _ = Hn(e, t, n, o, !1);
	return n.x = r, n.y = i, n.flip = a, o && (o.x = s, o.y = c, o.flip = l), Hn(e, t, n, o, !0) - _;
}
function Kn(e, t, n) {
	let r = Bn(e, t), i = r, a = t.map((e) => ({
		x: e.x,
		y: e.y,
		flip: e.flip
	})), o = Sn, s = (Cn / Sn) ** (1 / bn);
	for (let c = 0; c < bn; c++) {
		o *= s;
		let c = t[Math.floor(n() * t.length)];
		if (!c) continue;
		let l = c.x, u = c.y, d = c.flip, f = l, p = u, m = d, h, g = 0, _ = 0, v = 0, y = 0, b = 0, x = 0, S = n();
		if (S < .08 && c.block.flippable) m = +(d === 0);
		else if (S < .2) {
			if (h = t[Math.floor(n() * t.length)], !h || h === c) continue;
			g = h.x, _ = h.y, v = h.flip, f = g, p = _, y = l, b = u, x = v;
		} else {
			let e = 80 + o / Sn * 1500;
			f = l + (n() - .5) * 2 * e, p = u + (n() - .5) * 2 * e;
		}
		let C = Gn(e, t, c, f, p, m, h, y, b, x);
		if (!Number.isNaN(C)) {
			if (C <= 0 || n() < Math.exp(-C / o)) {
				if (r += C, r < i) {
					i = r;
					for (let e = 0; e < t.length; e++) {
						let n = t[e], r = a[e];
						n && r && (r.x = n.x, r.y = n.y, r.flip = n.flip);
					}
				}
			} else c.x = l, c.y = u, c.flip = d, h && (h.x = g, h.y = _, h.flip = v), Y(e, c, h);
		}
	}
	t.forEach((e, t) => {
		let n = a[t];
		n && Wn(e, n);
	});
}
function qn(e, t) {
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
function Jn(e, t) {
	let n = Bn(e, t), r = n, i = (i, a) => {
		let o = i.x, s = i.y;
		if (a.x === o && a.y === s || Math.abs(a.x - o) > En || Math.abs(a.y - s) > En) return;
		let c = Gn(e, t, i, a.x, a.y, i.flip);
		Number.isNaN(c) || (n + c <= r + Dn ? (n += c, r = Math.min(r, n)) : (i.x = o, i.y = s, Y(e, i, void 0)));
	};
	for (let e = 0; e < 3; e++) for (let e of t) for (let n of t) if (e !== n) for (let t of qn(e, n)) i(e, t);
}
function Yn(e, t) {
	for (let n = 0; n < 10; n++) {
		let n = !1;
		for (let r of t) {
			let i = 0, a = 0, o = 0;
			for (let t of e) t.source === r ? (i += t.bx - t.sourceX, a += t.by - t.sourceY[r.flip], o++) : t.target === r && (i += t.ax - t.targetX, a += t.ay - t.targetY[r.flip], o++);
			if (o === 0) continue;
			let s = {
				x: i / o,
				y: a / o
			};
			for (let i of ["x", "y"]) for (let a of Tn) for (;;) {
				let o = s[i] - r[i];
				if (Math.abs(o) < a) break;
				let c = r[i], l = c + Math.sign(o) * a, u = Gn(e, t, r, i === "x" ? l : r.x, i === "y" ? l : r.y, r.flip);
				if (Number.isNaN(u)) break;
				if (u < 0) n = !0;
				else {
					r[i] = c, Y(e, r, void 0);
					break;
				}
			}
		}
		if (!n) break;
	}
}
function Xn(e, t) {
	if (Math.abs(e.ay - e.by) >= .5 && Math.abs(e.ax - e.bx) >= .5) return !1;
	for (let n of t) if (n !== e.source && n !== e.target) {
		if (Nn(e, n)) return !1;
	} else for (let [t, r] of n.block.nodes) {
		if (t === e.from || t === e.to) continue;
		let i = n.x + r.x, a = n.y + (n.flip ? gn(n.block, r) : r.y);
		if (e.maxX > i && e.minX < i + r.width && e.maxY > a && e.minY < a + r.height) return !1;
	}
	return !0;
}
function Zn(e, t, n) {
	let r = 0;
	for (let i of e) (!n || i.source === n || i.target === n) && Xn(i, t) && r++;
	return r;
}
function Qn(e, t) {
	for (let t of e) Pn(t);
	for (let n = 0; n < 4; n++) {
		let n = !1;
		for (let r of t) {
			let i = r.x, a = r.y, o = Zn(e, t, r), s = [];
			for (let t of e) {
				if (t.source !== r && t.target !== r) continue;
				let e = t.source === r ? 1 : -1, n = (t.bx - t.ax) * e, o = (t.by - t.ay) * e;
				o !== 0 && Math.abs(o) <= An && s.push({
					x: i,
					y: a + o
				}), n !== 0 && Math.abs(n) <= An && s.push({
					x: i + n,
					y: a
				});
			}
			let c;
			for (let n of s) {
				let s = Gn(e, t, r, n.x, n.y, r.flip);
				if (Number.isNaN(s)) continue;
				let l = Zn(e, t, r) - o, u = Math.abs(n.x - i) + Math.abs(n.y - a);
				l > 0 && s <= l * jn && (!c || l > c.gain || l === c.gain && u < c.reach) && (c = {
					...n,
					gain: l,
					reach: u
				}), r.x = i, r.y = a, Y(e, r, void 0);
			}
			c && (r.x = c.x, r.y = c.y, Y(e, r, void 0), n = !0);
		}
		if (!n) break;
	}
}
function $n(e, t, n, r) {
	let i = e.nodes.get(t);
	if (!i) return !1;
	let a = (t) => r ? gn(e, t) : t.y, o = i.x + i.width / 2, s = a(i) + 50;
	for (let [r, c] of e.nodes) {
		if (r === t) continue;
		let e = s > a(c) && s < a(c) + c.height, l = o > c.x && o < c.x + c.width;
		if (n === 0 && e && c.x > i.x || n === 1 && e && c.x < i.x || n === 2 && l && a(c) > a(i) || n === 3 && l && a(c) < a(i)) return !1;
	}
	return !0;
}
function er(e, t, n, r) {
	let i = (i, a) => {
		let o = 0;
		for (let [s, c] of [
			[0, 1],
			[1, 0],
			[2, 3],
			[3, 2]
		]) $n(e, t, s, i) && $n(n, r, c, a) && (o |= 1 << s);
		return o;
	};
	return [
		i(0, 0),
		i(0, 1),
		i(1, 0),
		i(1, 1)
	];
}
function tr(e) {
	return new Map(e.map((e) => [e.block.id, {
		x: e.x,
		y: e.y,
		flip: e.flip
	}]));
}
function nr(e, t) {
	let { blocks: n, owners: r } = mn(e, t), i = hn(e, n, r, t), a = ln(e), o = n.map((e) => ({
		block: e,
		x: 0,
		y: 0,
		flip: 0
	})), s = /* @__PURE__ */ new Map();
	for (let e of o) for (let [t, n] of e.block.nodes) s.set(t, {
		p: e,
		x: n.x + n.width / 2,
		y: [n.y + 50, gn(e.block, n) + 50]
	});
	let c = e.edges.flatMap((e) => {
		let t = s.get(e.from), n = s.get(e.to);
		return !t || !n || t.p === n.p ? [] : [{
			source: t.p,
			target: n.p,
			sourceX: t.x,
			targetX: n.x,
			sourceY: t.y,
			targetY: n.y,
			from: e.from,
			to: e.to,
			weight: a.has(J(e.from, e.to)) ? 2 : 1,
			open: er(t.p.block, e.from, n.p.block, e.to),
			ax: 0,
			ay: 0,
			bx: 0,
			by: 0,
			minX: 0,
			maxX: 0,
			minY: 0,
			maxY: 0
		}];
	}), l = Infinity, u = /* @__PURE__ */ new Map();
	for (let t of xn) {
		for (let e of o) {
			let t = i.get(e.block.id) ?? {
				x: 0,
				y: 0
			};
			e.x = t.x, e.y = t.y, e.flip = 0;
		}
		Kn(c, o, Mn(t * 104729)), Yn(c, o), Jn(c, o), Yn(c, o), Qn(c, o);
		let n = Bn(c, o) + Bt(e, yn(o)) * 150 - Zn(c, o) * jn;
		n < l && (l = n, u = tr(o));
	}
	return u;
}
// src/layout/index.ts
function rr(e) {
	let t = ar(e);
	t && or(t.key, sr(t.doc));
	let n = cn(e) ? ir?.placement : void 0;
	return n ? vn(e, n, q) : q(e);
}
var ir;
function ar(e) {
	if (!cn(e)) return;
	let t = dn(e);
	if (ir?.key === t) return;
	let n = fn(e);
	if (un(n, q(n)) > 0) return {
		key: t,
		doc: n
	};
	ir = {
		key: t,
		placement: void 0
	};
}
function or(e, t) {
	ir = {
		key: e,
		placement: t
	};
}
function sr(e) {
	let t = q(e), n = nr(e, q), r = vn(e, n, q), i = (t) => un(e, t) + Bt(e, t) * 700;
	return i(r) < i(t) ? n : void 0;
}
// src/skill/layoutReport.ts
var cr = 4, lr = 1.5, ur = 3, dr = (e) => new Set(e.map(Math.round)).size, fr = (e) => dr(e.map((e) => e.x)), pr = (e) => dr(e.map((e) => e.y)), mr = (e) => `${fr(e)} x ${pr(e)}`, hr = (e, t) => e >= t ? `${(e / t).toFixed(1)} : 1` : `1 : ${(t / e).toFixed(1)}`;
function gr(e) {
	if (e.nodes.length === 0) return {
		summary: [],
		notes: []
	};
	let t = rr(e), n = (e) => {
		let n = t.nodes[e];
		return n ? [n] : [];
	}, r = e.nodes.flatMap((e) => n(e.id)), i = Nt([...r, ...Object.values(t.groups)]), a = Math.round(i.width), o = Math.round(i.height), s = Ft(Pt(e), t), c = s.flatMap((e, t) => s.slice(t + 1).filter((t) => !Lt(e, t) && Rt(e, t)).map((t) => `${e.from} --> ${e.to} and ${t.from} --> ${t.to}`)), l = c.length, u = [`layout: ${a} x ${o} (${hr(a, o)}), ${fr(r)} columns x ${pr(r)} rows of nodes, ${l} ${l === 1 ? "crossing" : "crossings"}`], d = wt(e.groups), f = (t) => e.nodes.filter((e) => Ot(d, e.parentId).includes(t)), p = Tt(e.groups).map((e) => ({
		g: e,
		rects: f(e.id).flatMap((e) => n(e.id))
	})).filter(({ rects: e }) => e.length > 0);
	p.length > 0 && u.push(`layout: zones, as columns x rows of nodes: ${p.map(({ g: e, rects: t }) => `"${e.label || e.id}" ${mr(t)}`).join(", ")}`);
	let m = [];
	o > a * lr && m.push({
		code: "tall-diagram",
		message: `The diagram is ${(o / a).toFixed(1)} times as tall as it is wide. Nodes that no edge puts in order are stacked in one column: where one of them really feeds another, declare that edge, and it moves to the right.`
	});
	for (let t of e.groups) {
		let r = e.nodes.filter((e) => e.parentId === t.id).flatMap((e) => n(e.id));
		r.length >= cr && fr(r) === 1 && m.push({
			code: "stacked-zone",
			message: `Zone "${t.label || t.id}" stacks its ${r.length} nodes in one column, because no edge runs between them. That is right for peers, such as replicas or separate stores. If one of them feeds another, declare that edge, and they spread to the right.`
		});
	}
	return l > 0 && m.push({
		code: "crossings",
		message: `${l === 1 ? "One pair of connections crosses" : `${l} pairs of connections cross`}, counted on straight lines between the nodes: ${c.slice(0, ur).join("; ")}${l > ur ? "; and more" : ""}. Swapping the declarations of two nodes that share a column often removes a crossing; references/layout.md has more.`
	}), {
		summary: u,
		notes: m
	};
}
var _r = (e) => e === " " || e === "\n" || ee(e) || e === "—" || e === "→" || e === "←" || e === "↔" || e === "・";
function vr(e) {
	if (e >= "ぁ" && e <= "ゟ") return "hiragana";
	if (e >= "ァ" && e <= "ヿ" && e !== "・") return "katakana";
	if (e >= "一" && e <= "鿿" || e >= "㐀" && e <= "䶿" || e === "々") return "kanji";
}
var yr = /* @__PURE__ */ new Set([..."をにへがはのとでもやか"]), br = 12, xr = /^[([{（「『【〈《〔]+$/, Sr = /^(.+?)([([{（「『【〈《〔]+)$/, Cr = /^[)\]}）」』】〉》〕。、，．・：；！？…‥ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]+/, wr = (e) => e === " " || e === "\n";
function Tr(e) {
	let t = e.flatMap((t, n) => {
		let r = e[n + 1];
		if (r !== void 0 && !wr(r) && !xr.test(t)) {
			let e = Sr.exec(t);
			if (e?.[1] && e[2]) return [e[1], e[2]];
		}
		return [t];
	}), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		t !== void 0 && !wr(t) && !wr(e) && Cr.test(e) ? n[n.length - 1] = t + e : n.push(e);
	}
	let r = [], i = "";
	for (let e of n) xr.test(e) ? i += e : i ? (wr(e) ? r.push(i, e) : r.push(i + e), i = "") : r.push(e);
	return i && r.push(i), r;
}
function X(e, t, n, r = "normal", i = C) {
	if (i(e, t, r) <= n) return e;
	let a = "";
	for (let o of e) {
		if (i(`${a + o}…`, t, r) > n) break;
		a += o;
	}
	return `${r === "mono" ? a : a.trimEnd()}…`;
}
function Er(e, t, n, r = 3, i = "normal", a = C) {
	let o = e.trim().replace(/\s*\n\s*/g, "\n").replace(/[^\S\n]+/g, " ");
	if (!o) return [];
	let s = [], c = "", l, u = 0, d = 0, f = "", p = () => {
		c && s.push(c), c = "", u = 0;
	};
	for (let e of o) {
		let r = vr(e);
		if (r) {
			let o = r === "kanji" && l === "hiragana" && d === 1 && !yr.has(f);
			(l === "other" || u >= br || a(c + e, t, i) > n || r === "kanji" && l !== "kanji" && !o || r === "katakana" && l !== "katakana") && p(), c += e, u++, d = r === "hiragana" ? l === "hiragana" ? d + 1 : l === "kanji" ? 1 : 2 : 0, f = e, l = r;
		} else _r(e) ? (p(), s.push(e), l = void 0) : (l !== "other" && p(), c += e, l = "other");
	}
	p();
	let m = Tr(s), h = [], g = "";
	for (let e = 0; e < m.length; e++) {
		let o = m[e] ?? "";
		if (!g && o === " ") continue;
		let s = g + o;
		if (o === "\n" || g && a(s, t, i) > n) {
			if (h.length + 1 >= r) {
				let r = (g + m.slice(e).join("")).trim().replace(/\n/g, " ");
				return h.push(X(r, t, n, i, a)), h;
			}
			h.push(X(g.trimEnd(), t, n, i, a)), g = o === " " || o === "\n" ? "" : o;
		} else g = s;
	}
	return g.trim() && h.push(X(g.trim(), t, n, i, a)), h;
}
// src/scene/calloutMeasure.ts
var Z = C, Dr = 14, Or = 16, kr = 414, Ar = 180, jr = 2, Mr = 4, Nr = 4, Pr = 202, Fr = {
	withLabel: 54,
	bare: 26
}, Ir = 18, Lr = 15, Rr = 12.5, zr = 440, Br = 15;
function Vr(e) {
	let t = T(e.body, { stripAllOuterBlankLines: !0 });
	if (!t) return;
	let n = t.split("\n"), r = (n.length > 10 ? [...n.slice(0, 9), "…"] : n).map((e) => X(e, Rr, zr, "mono", Z)), i = e.lang?.trim() ?? "", a = e.title?.trim() ?? "", o = i && a ? `${i} · ${a}` : i || a, s = o ? X(o, Rr, 412, "mono", Z) : "", c = s ? 30 : 0, l = (e) => Z(e, Rr, "mono");
	return {
		header: s,
		headerHeight: c,
		lines: r,
		minBoxW: Math.max(s ? l(`{ } ${s}`) : 0, ...r.map(l)) + Mr + 26,
		height: c + 21 + (r.length - 1) * 19 + Br
	};
}
function Q(e) {
	let t = 0;
	for (let n of e) n === "…" && t++;
	return t;
}
function Hr(e, t, n) {
	let r = Er(e, 14, t, Nr, "normal", Z), i = r.length;
	if (e.includes("\n") || i < 2) return r;
	let a = Q(e);
	if (Q(r.join("")) > a || n >= t) return r;
	let o = r, s = n, c = t;
	for (let t = 0; t < 8; t++) {
		let t = (s + c) / 2, n = Er(e, 14, t, Nr, "normal", Z);
		n.length <= i && Q(n.join("")) <= a ? (o = n, c = t) : s = t;
	}
	return o;
}
var Ur = .25;
function Wr(e, t) {
	let n = Er(e, 14, t, Nr, "normal", Z);
	if (n.length < 2 || e.includes("\n")) return n;
	let r = (e) => Z(e[e.length - 1] ?? "", 14, "normal") < Ur * t;
	if (!r(n)) return n;
	let i = Q(e);
	for (let a = t - 6; a >= Math.max(Pr, t * .55); a -= 6) {
		let t = Er(e, 14, a, Nr, "normal", Z);
		if (t.length !== n.length || Q(t.join("")) > i) break;
		if (!r(t)) return t;
	}
	return n;
}
var Gr = (e) => e.reduce((e, t) => Math.max(e, Z(t, 14, "normal")), 0);
function Kr(e, t, n) {
	let r = t > 0 ? (e ? Fr.withLabel : Fr.bare) + (t - 1) * 22 : e ? 27 : void 0;
	if (n === void 0) return {
		offsetY: 0,
		height: t === 0 ? 36 : (r ?? 0) + Ir
	};
	let i = r === void 0 ? Or : r + Lr;
	return {
		offsetY: i,
		height: i + n + Or
	};
}
function qr(e) {
	let t = Jr(e), n = e.code ? T(e.code.body, { stripAllOuterBlankLines: !0 }).split("\n") : [], r = t?.code?.lines ?? [], i = n.length > 10;
	return {
		label: !!e.label && t?.label !== e.label,
		description: Q((t?.descLines ?? []).join("")) > Q(e.description ?? ""),
		codeLines: i ? n.length : 0,
		wideCodeLines: n.flatMap((e, t) => t < r.length - +!!i && r[t] !== e ? [t + 1] : [])
	};
}
function Jr(e) {
	let t = e.code ? Vr(e.code) : void 0, n = e.label ? X(e.label, 15, kr, "bold", Z) : "", r = n ? Z(n, 15, "bold") : 0, i = e.stopLabel === void 0 ? 0 : 28, a = n ? 0 : i, o = n ? i + r + jr : 0, s = Math.max(o, t ? t.minBoxW : 0), c = e.description || t !== void 0 ? 16 : Dr, l = (e) => Math.max(t ? Ar : e.length > 0 ? 210 : 60, Math.ceil(Math.max(s, e.length > 0 ? Gr(e) + jr : 0) + c * 2)) + a, u = [];
	if (e.description) {
		let t = Math.max(kr, s - jr);
		u = Hr(e.description, t, Pr), u = Wr(e.description, Math.max(s, Gr(u) + jr) - jr);
	}
	if (!n && u.length === 0 && !t) return null;
	let { offsetY: d, height: f } = Kr(n !== "", u.length, t?.height), p = l(u), m = {
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
// src/scene/textCuts.ts
var Yr = (e, t, n, r) => X(e, t, n, r) !== e;
function Xr(e) {
	let t = [], n = U.width;
	for (let r of e.nodes) Yr(r.label, 14, n, "bold") && t.push({
		kind: "node-label",
		node: r.id,
		text: r.label
	}), r.sub && Yr(r.sub, 11.5, n) && t.push({
		kind: "node-sub",
		node: r.id,
		text: r.sub
	}), r.badge && Yr(r.badge, 11, 120, "bold") && t.push({
		kind: "node-badge",
		node: r.id,
		text: r.badge
	});
	for (let n of e.edges) n.label && Yr(n.label, 11, 180) && t.push({
		kind: "edge-label",
		from: n.from,
		to: n.to,
		text: n.label
	});
	for (let n of e.steps) {
		for (let e of n.states) e.badge && Yr(e.badge, 11, 120, "bold") && t.push({
			kind: "state-badge",
			step: n.index,
			target: e.target,
			text: e.badge
		});
		for (let e of n.animations) {
			let r = {
				step: n.index,
				from: e.from,
				to: e.to
			}, i = qr(e);
			i.label && e.label && t.push({
				kind: "packet-label",
				...r,
				text: e.label
			}), i.description && e.description && t.push({
				kind: "packet-desc",
				...r,
				text: e.description
			}), i.codeLines > 0 && t.push({
				kind: "code-lines",
				...r,
				lines: i.codeLines
			});
			for (let e of i.wideCodeLines) t.push({
				kind: "code-width",
				...r,
				line: e
			});
		}
	}
	return t;
}
// src/skill/packets.ts
var Zr = (e, t) => e.from === t.from && e.to === t.to || e.direction === "bidirectional" && e.from === t.to && e.to === t.from, Qr = 3, $ = (e) => `step ${e.index + 1} "${e.title}"`, $r = (e) => `animate ${e.from} ${e.direction === "bidirectional" ? "<->" : "-->"} ${e.to}`, ei = 4;
function ti(e, t, n, r) {
	let i = /* @__PURE__ */ new Map([[t, t]]), a = [t];
	for (let t = a.shift(); t !== void 0 && t !== n; t = a.shift()) for (let n of e.edges) {
		if (n.from === n.to) continue;
		let e = n.from === t ? n.to : n.to === t && (r || n.direction === "bidirectional") ? n.from : void 0;
		e === void 0 || i.has(e) || (i.set(e, t), a.push(e));
	}
	if (!i.has(n)) return;
	let o = [n];
	for (; o[0] !== t;) o.unshift(i.get(o[0] ?? t) ?? t);
	return o.length - 1 <= ei ? o : void 0;
}
function ni(e, t) {
	let n = (e) => e.slice(1).map((t, n) => `animate ${e[n]} --> ${t}`).join(", then "), r = t.direction === "bidirectional" ? ", and the answer back the same way" : "", i = ti(e, t.from, t.to, !1);
	if (i) return `The edges join them by way of ${i.slice(1, -1).join(", ")}: send ${n(i)} instead${r}.`;
	let a = ti(e, t.from, t.to, !0);
	if (a) {
		let t = a.slice(1).map((e, t) => ({
			from: a[t] ?? "",
			to: e
		})).filter((t) => !e.edges.some((e) => Zr(e, t))).map((e) => `${e.to} --> ${e.from}`);
		return a.length === 2 ? `The edge ${t[0]} runs the other way: make it <-> so that the packet can ride it back.` : `The edges on the way run the other way (${t.join(", ")}): make each of those edges <->, then send ${n(a)} instead${r}.`;
	}
	return `No edges join the two. If the code shows that they talk to each other directly, declare ${t.from} --> ${t.to} : "..."; if it does not, leave the packet out.`;
}
function ri(e, t) {
	let n = "step" in e ? t.steps[e.step] : void 0, r = n ? `${$(n)}: ` : "";
	switch (e.kind) {
		case "node-label": return `The label of node ${e.node} is too long for its place and is cut off: "${e.text}". Shorten it, and move detail into sub.`;
		case "node-sub": return `The sub of node ${e.node} is too long and is cut off: "${e.text}". Shorten it.`;
		case "node-badge": return `The badge of node ${e.node} is too long and is cut off: "${e.text}". A badge is a word or two.`;
		case "state-badge": return `${r}the badge set on ${e.target} is too long and is cut off: "${e.text}". A badge is a word or two.`;
		case "edge-label": return `The label of ${e.from} --> ${e.to} is too long and is cut off: "${e.text}". Shorten it.`;
		case "packet-label": return `${r}the label of the packet from ${e.from} to ${e.to} is too long and is cut off: "${e.text}". Keep the label short, and move the rest into desc.`;
		case "packet-desc": return `${r}the desc of the packet from ${e.from} to ${e.to} is longer than the four lines a callout shows, and is cut off. Shorten it to one or two sentences.`;
		case "code-lines": return `${r}the code of the packet from ${e.from} to ${e.to} has ${e.lines} lines, and a callout shows 10. Keep the lines that matter.`;
		case "code-width": return `${r}line ${e.line} of the code of the packet from ${e.from} to ${e.to} is too wide and is cut off. Break it, or shorten it to about 55 characters.`;
	}
}
function ii(e) {
	let t = [], n = (e, n) => {
		t.push({
			code: e,
			message: n
		});
	};
	for (let t of e.edges) t.label || n("edge-without-label", `${t.from} --> ${t.to} has no label. Say what travels on it or how the two are related, such as : "HTTPS".`);
	for (let t of e.steps) {
		t.description.trim() || n("step-without-desc", `${$(t)} has no desc. Add one or two sentences that say what happens in it and why.`), t.animations.length === 0 && t.states.length === 0 && t.focus.length === 0 && n("empty-step", `${$(t)} shows nothing: it has no animate, state or focus.`);
		for (let r of t.animations) e.edges.some((e) => Zr(e, r)) || n("animate-without-edge", r.from === r.to ? `${$(t)}: ${$r(r)} loops on a node that has no loop edge. Declare it: ${r.from} --> ${r.to} : "...".` : `${$(t)}: ${$r(r)} travels where no edge is declared, so it has no line to follow. ${ni(e, r)}`), r.label || n("animate-without-label", `${$(t)}: ${$r(r)} has no label. Name what is sent, such as : "POST /orders".`), r.description?.trim() || n("animate-without-desc", `${$(t)}: ${$r(r)} has no desc. Add [desc: "..."] that says what this message does or decides.`);
	}
	let r = e.steps.flatMap((e) => e.animations);
	r.length >= Qr && !r.some((e) => e.code?.body.trim()) && n("no-code", "No animate shows a code block. Attach the request, query, event or response that matters most to one to three of them.");
	for (let t of Xr(e)) n("text-cut", ri(t, e));
	return t;
}
// src/skill/check.ts
var ai = "Usage: node dav-check.mjs [--write] [--detail] <file.dav>...", oi = ["--write", "--detail"], si = 0, ci = 1, li = 2;
function ui(e, t) {
	let n = Number.isNaN(t) ? 0 : Math.max(0, Math.min(e.length, Math.trunc(t))), r = n === 0 ? 1 : n - e.lastIndexOf("\n", n - 1);
	return `${te(e, n)}:${r}`;
}
function di(e, t, n) {
	return `${e}:${ui(t, n.from)}: ${n.severity} ${n.code}: ${mt(n)}`;
}
function fi(n, r, i) {
	let a = e(n, "utf8").replace(/^﻿/, "");
	if (r) {
		let e = yt(a);
		e !== a && (t(n, e), a = e);
	}
	let { document: o, diagnostics: s } = st(a);
	for (let e of s) console.log(di(n, a, e));
	let c = i && s.length === 0 ? ii(o) : [];
	for (let e of c) console.log(`${n}: hint ${e.code}: ${e.message}`);
	if (i && s.length === 0) {
		let { summary: e, notes: t } = gr(o);
		for (let t of e) console.log(`${n}: ${t}`);
		for (let e of t) console.log(`${n}: note ${e.code}: ${e.message}`);
	}
	if (s.length === 0 && c.length === 0) {
		let { nodes: e, edges: t, steps: r } = o;
		console.log(`${n}: ok (${e.length} nodes, ${t.length} edges, ${r.length} steps)`);
	}
	return s.length === 0 && c.length === 0;
}
function pi(e, t = ai) {
	if (e.includes("--help") || e.includes("-h")) return console.log(t), si;
	let n = e.filter((e) => !oi.includes(e));
	if (n.length === 0 || n.some((e) => e.startsWith("-"))) return console.error(t), li;
	let r = !0;
	for (let t of n) try {
		fi(t, e.includes("--write"), e.includes("--detail")) || (r = !1);
	} catch (e) {
		return console.error(`${t}: ${e instanceof Error ? e.message : String(e)}`), li;
	}
	return r ? si : ci;
}
// src/skill/checkEntry.ts
process.exitCode = pi(process.argv.slice(2));
