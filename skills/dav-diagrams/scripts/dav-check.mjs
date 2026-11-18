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
var x = /* @__PURE__ */ "server.container.function.runtime.database.cache.queue.storage.lb.firewall.cdn.cloud.building.router.hub.wifi.external.auth.ai.api.mail.monitor.schedule.search.logic.webhook.payment.key.screen.modal.browser.desktop.mobile.terminal.device.printer.chat.sheet.file.user.users.bot".split(".");
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
function D(e, t) {
	return `${e}->${t}`;
}
var O = {
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
}, k = {
	node: /* @__PURE__ */ new Set([
		"badge",
		"visible",
		"color"
	]),
	group: /* @__PURE__ */ new Set(["color"]),
	edge: /* @__PURE__ */ new Set(["visible", "color"])
}, A = [
	"-->",
	"..>",
	"<->",
	"<.>"
], j = {
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
function M(e, t) {
	let n, r = 3, i = e.toLowerCase();
	for (let e of t) {
		let t = e.length <= 3 ? 1 : 2, a = ee(i, e);
		a <= t && a < r && (n = e, r = a);
	}
	return n;
}
function ee(e, t) {
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
var N = 1024, te = 0, ne = class {
	constructor(e, t) {
		this.from = e, this.to = t;
	}
}, P = class {
	constructor(e = {}) {
		this.id = te++, this.perNode = !!e.perNode, this.deserialize = e.deserialize || (() => {
			throw Error("This node type doesn't define a deserialize function");
		}), this.combine = e.combine || null;
	}
	add(e) {
		if (this.perNode) throw RangeError("Can't add per-node props to node types");
		return typeof e != "function" && (e = F.match(e)), (t) => {
			let n = e(t);
			return n === void 0 ? null : [this, n];
		};
	}
};
P.closedBy = new P({ deserialize: (e) => e.split(" ") }), P.openedBy = new P({ deserialize: (e) => e.split(" ") }), P.group = new P({ deserialize: (e) => e.split(" ") }), P.isolate = new P({ deserialize: (e) => {
	if (e && e != "rtl" && e != "ltr" && e != "auto") throw RangeError("Invalid value for isolate: " + e);
	return e || "auto";
} }), P.contextHash = new P({ perNode: !0 }), P.lookAhead = new P({ perNode: !0 }), P.mounted = new P({ perNode: !0 });
var re = class {
	constructor(e, t, n, r = !1) {
		this.tree = e, this.overlay = t, this.parser = n, this.bracketed = r;
	}
	static get(e) {
		return e && e.props && e.props[P.mounted.id];
	}
}, ie = Object.create(null), F = class e {
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
			let t = this.prop(P.group);
			return t ? t.indexOf(e) > -1 : !1;
		}
		return this.id == e;
	}
	static match(e) {
		let t = Object.create(null);
		for (let n in e) for (let r of n.split(" ")) t[r] = e[n];
		return (e) => {
			for (let n = e.prop(P.group), r = -1; r < (n ? n.length : 0); r++) {
				let i = t[r < 0 ? e.name : n[r]];
				if (i) return i;
			}
		};
	}
};
F.none = new F("", Object.create(null), 0, 8);
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
			n.push(r ? new F(e.name, r, e.id, e.flags) : e);
		}
		return new e(n);
	}
}, oe = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), I;
(function(e) {
	e[e.ExcludeBuffers = 1] = "ExcludeBuffers", e[e.IncludeAnonymous = 2] = "IncludeAnonymous", e[e.IgnoreMounts = 4] = "IgnoreMounts", e[e.IgnoreOverlays = 8] = "IgnoreOverlays", e[e.EnterBracketed = 16] = "EnterBracketed";
})(I ||= {});
var L = class e {
	constructor(e, t, n, r, i) {
		if (this.type = e, this.children = t, this.positions = n, this.length = r, this.props = null, i && i.length) {
			this.props = Object.create(null);
			for (let [e, t] of i) this.props[typeof e == "number" ? e : e.id] = t;
		}
	}
	toString() {
		let e = re.get(this);
		if (e && !e.overlay) return e.tree.toString();
		let t = "";
		for (let e of this.children) {
			let n = e.toString();
			n && (t && (t += ","), t += n);
		}
		return this.type.name ? (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (t.length ? "(" + t + ")" : "") : t;
	}
	cursor(e = 0) {
		return new be(this.topNode, e);
	}
	cursorAt(e, t = 0, n = 0) {
		let r = new be(oe.get(this) || this.topNode);
		return r.moveTo(e, t), oe.set(this, r._tree), r;
	}
	get topNode() {
		return new R(this, 0, 0, null);
	}
	resolve(e, t = 0) {
		let n = de(oe.get(this) || this.topNode, e, t, !1);
		return oe.set(this, n), n;
	}
	resolveInner(e, t = 0) {
		let n = de(se.get(this) || this.topNode, e, t, !0);
		return se.set(this, n), n;
	}
	resolveStack(e, t = 0) {
		return ye(this, e, t);
	}
	iterate(e) {
		let { enter: t, leave: n, from: r = 0, to: i = this.length } = e, a = e.mode || 0, o = (a & I.IncludeAnonymous) > 0;
		for (let e = this.cursor(a | I.IncludeAnonymous);;) {
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
		return this.children.length <= 8 ? this : Te(F.none, this.children, this.positions, 0, this.children.length, 0, this.length, (t, n, r) => new e(this.type, t, n, r, this.propValues), t.makeTree || ((t, n, r) => new e(F.none, t, n, r)));
	}
	static build(e) {
		return Se(e);
	}
};
L.empty = new L(F.none, [], [], 0);
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
}, le = class e {
	constructor(e, t, n) {
		this.buffer = e, this.length = t, this.set = n;
	}
	get type() {
		return F.none;
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
		for (let s = e; s != t && !(ue(i, r, a[s + 1], a[s + 2]) && (o = s, n > 0)); s = a[s + 3]);
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
function ue(e, t, n, r) {
	switch (e) {
		case -2: return n < t;
		case -1: return r >= t && n < t;
		case 0: return n < t && r > t;
		case 1: return n <= t && r > t;
		case 2: return r > t;
		case 4: return !0;
	}
}
function de(e, t, n, r) {
	for (; e.from == e.to || (n < 1 ? e.from >= t : e.from > t) || (n > -1 ? e.to <= t : e.to < t);) {
		let t = !r && e instanceof R && e.index < 0 ? null : e.parent;
		if (!t) return e;
		e = t;
	}
	let i = r ? 0 : I.IgnoreOverlays;
	if (r) for (let r = e, a = r.parent; a; r = a, a = r.parent) r instanceof R && r.index < 0 && a.enter(t, n, i)?.from != r.from && (e = a);
	for (;;) {
		let r = e.enter(t, n, i);
		if (!r) return e;
		e = r;
	}
}
var fe = class {
	cursor(e = 0) {
		return new be(this, e);
	}
	getChild(e, t = null, n = null) {
		let r = pe(this, e, t, n);
		return r.length ? r[0] : null;
	}
	getChildren(e, t = null, n = null) {
		return pe(this, e, t, n);
	}
	resolve(e, t = 0) {
		return de(this, e, t, !1);
	}
	resolveInner(e, t = 0) {
		return de(this, e, t, !0);
	}
	matchContext(e) {
		return me(this.parent, e);
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
}, R = class e extends fe {
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
				if (a & I.EnterBracketed && l instanceof L && (d = re.get(l)) && !d.overlay && d.bracketed && r >= u && r <= u + l.length || ue(i, r, u, u + l.length)) {
					if (l instanceof le) {
						if (a & I.ExcludeBuffers) continue;
						let e = l.findChild(0, l.buffer.length, n, r - u, i);
						if (e > -1) return new ge(new he(o, l, t, u), null, e);
					} else if (a & I.IncludeAnonymous || !l.type.isAnonymous || xe(l)) {
						let s;
						if (!(a & I.IgnoreMounts) && (s = re.get(l)) && !s.overlay) return new e(s.tree, u, t, o);
						let c = new e(l, u, t, o);
						return a & I.IncludeAnonymous || !c.type.isAnonymous ? c : c.nextChild(n < 0 ? l.children.length - 1 : 0, n, r, i, a);
					}
				}
			}
			if (a & I.IncludeAnonymous || !o.type.isAnonymous || (t = o.index >= 0 ? o.index + n : n < 0 ? -1 : o._parent._tree.children.length, o = o._parent, !o)) return null;
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
		if (!(r & I.IgnoreOverlays) && (i = re.get(this._tree)) && i.overlay) {
			let a = t - this.from, o = r & I.EnterBracketed && i.bracketed;
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
function pe(e, t, n, r) {
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
function me(e, t, n = t.length - 1) {
	for (let r = e; n >= 0; r = r.parent) {
		if (!r) return !1;
		if (!r.type.isAnonymous) {
			if (t[n] && t[n] != r.name) return !1;
			n--;
		}
	}
	return !0;
}
var he = class {
	constructor(e, t, n, r) {
		this.parent = e, this.buffer = t, this.index = n, this.start = r;
	}
}, ge = class e extends fe {
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
		if (r & I.ExcludeBuffers) return null;
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
		return new L(this.type, e, t, this.to - this.from);
	}
	toString() {
		return this.context.buffer.childString(this.index);
	}
};
function _e(e) {
	if (!e.length) return null;
	let t = 0, n = e[0];
	for (let r = 1; r < e.length; r++) {
		let i = e[r];
		(i.from > n.from || i.to < n.to) && (n = i, t = r);
	}
	let r = n instanceof R && n.index < 0 ? null : n.parent, i = e.slice();
	return r ? i[t] = r : i.splice(t, 1), new ve(i, n);
}
var ve = class {
	constructor(e, t) {
		this.heads = e, this.node = t;
	}
	get next() {
		return _e(this.heads);
	}
};
function ye(e, t, n) {
	let r = e.resolveInner(t, n), i = null;
	for (let e = r instanceof R ? r : r.context.parent; e; e = e.parent) if (e.index < 0) {
		let a = e.parent;
		(i ||= [r]).push(a.resolve(t, n)), e = a;
	} else {
		let a = re.get(e.tree);
		if (a && a.overlay && a.overlay[0].from <= t && a.overlay[a.overlay.length - 1].to >= t) {
			let o = new R(a.tree, a.overlay[0].from + e.from, -1, e);
			(i ||= [r]).push(de(o, t, n, !1));
		}
	}
	return i ? _e(i) : r;
}
var be = class {
	get name() {
		return this.type.name;
	}
	constructor(e, t = 0) {
		if (this.buffer = null, this.stack = [], this.index = 0, this.bufferNode = null, this.mode = t & ~I.EnterBracketed, e instanceof R) this.yieldNode(e);
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
		return e ? e instanceof R ? (this.buffer = null, this.yieldNode(e)) : (this.buffer = e.context, this.yieldBuf(e.index, e.type)) : !1;
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
		return this.buffer ? n & I.ExcludeBuffers ? !1 : this.enterChild(1, e, t) : this.yield(this._tree.enter(e, t, n));
	}
	parent() {
		if (!this.buffer) return this.yieldNode(this.mode & I.IncludeAnonymous ? this._tree._parent : this._tree.parent);
		if (this.stack.length) return this.yieldBuf(this.stack.pop());
		let e = this.mode & I.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
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
			if (this.mode & I.IncludeAnonymous || e instanceof le || !e.type.isAnonymous || xe(e)) return !1;
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
		for (let e = n; e < this.stack.length; e++) t = new ge(this.buffer, t, this.stack[e]);
		return this.bufferNode = new ge(this.buffer, t, this.index);
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
		if (!this.buffer) return me(this.node.parent, e);
		let { buffer: t } = this.buffer, { types: n } = t.set;
		for (let r = e.length - 1, i = this.stack.length - 1; r >= 0; i--) {
			if (i < 0) return me(this._tree, e, r);
			let a = n[t.buffer[this.stack[i]]];
			if (!a.isAnonymous) {
				if (e[r] && e[r] != a.name) return !1;
				r--;
			}
		}
		return !0;
	}
};
function xe(e) {
	return e.children.some((e) => e instanceof le || !e.type.isAnonymous || xe(e));
}
function Se(e) {
	let { buffer: t, nodeSet: n, maxBufferLength: r = N, reused: i = [], minRepeatType: a = n.types.length } = e, o = Array.isArray(t) ? new ce(t, t.length) : t, s = n.types, c = 0, l = 0;
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
			O = new le(t, C - k.start, n), A = k.start - e;
		} else {
			let e = o.pos - w;
			o.next();
			let t = [], s = [], c = x >= a ? x : -1, h = 0, g = C, _ = T;
			for (; o.pos > e;) c >= 0 && o.id == c && o.size >= 0 ? (o.end <= g - r && (p(t, s, S, h, o.end, g, c, _, E), h = t.length, g = o.end, _ = l), o.next()) : b > 2500 ? d(S, e, t, s) : (c >= 0 && o.size == -1 && i[o.id].type == n.types[c] && (h < t.length && p(t, s, S, h, o.end, g, c, _, E), h = t.length + 1, g = o.start, _ = l), u(S, e, t, s, c, b + 1));
			if (c >= 0 && h > 0 && h < t.length && p(t, s, S, h, S, g, c, _, E), t.reverse(), s.reverse(), c > -1 && h > 0) {
				let e = f(D, E);
				O = Te(D, t, s, 0, t.length, 0, C - S, e, e);
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
			i.push(new le(t, s[2] - r, n)), a.push(r - e);
		}
	}
	function f(e, t) {
		return (n, r, i) => {
			let a = 0, o = n.length - 1, s, c;
			if (o >= 0 && (s = n[o]) instanceof L) {
				if (!o && s.type == e && s.length == i) return s;
				(c = s.prop(P.lookAhead)) && (a = r[o] + s.length + c - i);
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
			let e = [P.contextHash, a];
			o = o ? [e].concat(o) : [e];
		}
		if (i > 25) {
			let e = [P.lookAhead, i];
			o = o ? [e].concat(o) : [e];
		}
		return new L(e, t, n, r, o);
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
	return new L(s[e.topID], _.reverse(), v.reverse(), y);
}
var Ce = /* @__PURE__ */ new WeakMap();
function we(e, t) {
	if (!e.isAnonymous || t instanceof le || t.type != e) return 1;
	let n = Ce.get(t);
	if (n == null) {
		n = 1;
		for (let r of t.children) {
			if (r.type != e || !(r instanceof L)) {
				n = 1;
				break;
			}
			n += we(e, r);
		}
		Ce.set(t, n);
	}
	return n;
}
function Te(e, t, n, r, i, a, o, s, c) {
	let l = 0;
	for (let n = r; n < i; n++) l += we(e, t[n]);
	let u = Math.ceil(l * 1.5 / 8), d = [], f = [];
	function p(t, n, r, i, o) {
		for (let s = r; s < i;) {
			let r = s, l = n[s], m = we(e, t[s]);
			for (s++; s < i; s++) {
				let n = we(e, t[s]);
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
				d.push(Te(e, t, n, r, s, l, i, null, c));
			}
			f.push(l + o - a);
		}
	}
	return p(t, n, r, i, 0), (s || c)(d, f, o);
}
var Ee = class {
	startParse(e, t, n) {
		return typeof e == "string" && (e = new De(e)), n = n ? n.length ? n.map((e) => new ne(e.from, e.to)) : [new ne(0, 0)] : [new ne(0, e.length)], this.createParse(e, t || [], n);
	}
	parse(e, t, n) {
		let r = this.startParse(e, t, n);
		for (;;) {
			let e = r.advance();
			if (e) return e;
		}
	}
}, De = class {
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
new P({ perNode: !0 });
// ../../node_modules/@lezer/lr/dist/index.js
var Oe = class e {
	constructor(e, t, n, r, i, a, o, s, c, l = 0, u) {
		this.p = e, this.stack = t, this.state = n, this.reducePos = r, this.pos = i, this.score = a, this.buffer = o, this.bufferBase = s, this.curContext = c, this.lookAhead = l, this.parent = u;
	}
	toString() {
		return `[${this.stack.filter((e, t) => t % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
	}
	static start(t, n, r = 0) {
		let i = t.parser.context;
		return new e(t, [], n, r, r, 0, [], 0, i ? new ke(i, i.start) : null, 0, null);
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
		for (let t = new Ae(this);;) {
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
			let t = new ke(this.curContext.tracker, e);
			t.hash != this.curContext.hash && this.emitContext(), this.curContext = t;
		}
	}
	setLookAhead(e) {
		return e <= this.lookAhead ? !1 : (this.emitLookAhead(), this.lookAhead = e, !0);
	}
	close() {
		this.curContext && this.curContext.tracker.strict && this.emitContext(), this.lookAhead > 0 && this.emitLookAhead();
	}
}, ke = class {
	constructor(e, t) {
		this.tracker = e, this.context = t, this.hash = e.strict ? e.hash(t) : 0;
	}
}, Ae = class {
	constructor(e) {
		this.start = e, this.state = e.state, this.stack = e.stack, this.base = this.stack.length;
	}
	reduce(e) {
		let t = e & 65535, n = e >> 19;
		n == 0 ? (this.stack == this.start.stack && (this.stack = this.stack.slice()), this.stack.push(this.state, 0, 0), this.base += 3) : this.base -= (n - 1) * 3;
		let r = this.start.p.parser.getGoto(this.stack[this.base - 3], t, !0);
		this.state = r;
	}
}, je = class e {
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
function Me(e, t = Uint16Array) {
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
var Ne = class {
	constructor() {
		this.start = -1, this.value = -1, this.end = -1, this.extended = -1, this.lookAhead = 0, this.mask = 0, this.context = 0;
	}
}, Pe = new Ne(), Fe = class {
	constructor(e, t) {
		this.input = e, this.ranges = t, this.chunk = "", this.chunkOff = 0, this.chunk2 = "", this.chunk2Pos = 0, this.next = -1, this.token = Pe, this.rangeIndex = 0, this.pos = this.chunkPos = t[0].from, this.range = t[0], this.end = t[t.length - 1].to, this.readNext();
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
		if (t ? (this.token = t, t.start = e, t.lookAhead = e + 1, t.value = t.extended = -1) : this.token = Pe, this.pos != e) {
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
}, Ie = class {
	constructor(e, t) {
		this.data = e, this.id = t;
	}
	token(e, t) {
		let { parser: n } = t.p;
		Re(this.data, e, t, this.id, n.data, n.tokenPrecTable);
	}
};
Ie.prototype.contextual = Ie.prototype.fallback = Ie.prototype.extend = !1;
var Le = class {
	constructor(e, t, n) {
		this.precTable = t, this.elseToken = n, this.data = typeof e == "string" ? Me(e) : e;
	}
	token(e, t) {
		let n = e.pos, r = 0;
		for (;;) {
			let n = e.next < 0, i = e.resolveOffset(1, 1);
			if (Re(this.data, e, t, 0, this.data, this.precTable), e.token.value > -1) break;
			if (this.elseToken == null) return;
			if (n || r++, i == null) break;
			e.reset(i, e.token);
		}
		r && (e.reset(n, e.token), e.acceptToken(this.elseToken, r));
	}
};
Le.prototype.contextual = Ie.prototype.fallback = Ie.prototype.extend = !1;
function Re(e, t, n, r, i, a) {
	let o = 0, s = 1 << r, { dialect: c } = n.p.parser;
	scan: for (; (s & e[o]) != 0;) {
		let n = e[o + 1];
		for (let r = o + 3; r < n; r += 2) if ((e[r + 1] & s) > 0) {
			let n = e[r];
			if (c.allows(n) && (t.token.value == -1 || t.token.value == n || Be(n, t.token.value, i, a))) {
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
function ze(e, t, n) {
	for (let r = t, i; (i = e[r]) != 65535; r++) if (i == n) return r - t;
	return -1;
}
function Be(e, t, n, r) {
	let i = ze(n, r, t);
	return i < 0 || ze(n, r, e) < i;
}
var z = typeof process < "u" && process.env && /\bparse\b/.test(process.env.LOG), Ve = null;
function He(e, t, n) {
	let r = e.cursor(I.IncludeAnonymous);
	for (r.moveTo(t);;) if (!(n < 0 ? r.childBefore(t) : r.childAfter(t))) for (;;) {
		if ((n < 0 ? r.to < t : r.from > t) && !r.type.isError) return n < 0 ? Math.max(0, Math.min(r.to - 1, t - 25)) : Math.min(e.length, Math.max(r.from + 1, t + 25));
		if (n < 0 ? r.prevSibling() : r.nextSibling()) break;
		if (!r.parent()) return n < 0 ? 0 : e.length;
	}
}
var Ue = class {
	constructor(e, t) {
		this.fragments = e, this.minRepeat = t, this.i = 0, this.fragment = null, this.safeFrom = -1, this.safeTo = -1, this.trees = [], this.start = [], this.index = [], this.lastRepeat = null, this.lastRepeatPos = -1, this.nextFragment();
	}
	nextFragment() {
		let e = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
		if (e) {
			for (this.safeFrom = e.openStart ? He(e.tree, e.from + e.offset, 1) - e.offset : e.from, this.safeTo = e.openEnd ? He(e.tree, e.to + e.offset, -1) - e.offset : e.to; this.trees.length;) this.trees.pop(), this.start.pop(), this.index.pop();
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
			if (i instanceof L) {
				let n = a > this.lastRepeatPos && i.type.id >= this.minRepeat;
				if (a == e || n) {
					let t = a + i.length, r;
					if (a >= this.safeFrom && t <= this.safeTo && (!(r = i.prop(P.lookAhead)) || t + r < this.fragment.to) && (n && (this.lastRepeat = i, this.lastRepeatPos = a), a == e)) return i;
				}
				this.index[t]++, a + i.length >= Math.max(this.safeFrom, e) && (this.trees.push(i), this.start.push(a), this.index.push(0));
			} else this.index[t]++, this.nextStart = a + i.length;
		}
	}
}, We = class {
	constructor(e, t) {
		this.stream = t, this.tokens = [], this.mainToken = null, this.actions = [], this.tokens = e.tokenizers.map((e) => new Ne());
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
		return s && e.setLookAhead(s), !n && e.pos == this.stream.end && (n = new Ne(), n.value = e.p.parser.eofTerm, n.start = n.end = e.pos, t = this.addActions(e, n.value, n.end, t)), this.mainToken = n, this.actions;
	}
	getMainToken(e) {
		if (this.mainToken) return this.mainToken;
		let t = new Ne(), { pos: n, p: r } = e;
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
				if (o[s + 1] == 1) s = B(o, s + 2);
				else {
					r == 0 && o[s + 1] == 2 && (r = this.putAction(B(o, s + 2), t, n, r));
					break;
				}
			}
			o[s] == t && (r = this.putAction(B(o, s + 1), t, n, r));
		}
		return r;
	}
}, Ge = class {
	constructor(e, t, n, r) {
		this.parser = e, this.input = t, this.ranges = r, this.recovering = 0, this.nextStackID = 9812, this.minStackPos = 0, this.reused = [], this.stoppedAt = null, this.lastBigReductionStart = -1, this.lastBigReductionSize = 0, this.bigReductionCount = 0, this.stream = new Fe(t, r), this.tokens = new We(e, this.stream), this.topTerm = e.top[1];
		let { from: i } = r[0];
		this.stacks = [Oe.start(this, e.top[0], i)], this.fragments = n.length && this.stream.end - i > e.bufferLength * 4 ? new Ue(n, e.minRepeatTerm) : null;
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
			let e = r && Ye(r);
			if (e) return z && console.log("Finish with " + this.stackID(e)), this.stackToTree(e);
			if (this.parser.strict) throw z && r && console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none")), SyntaxError("No parse at " + t);
			this.recovering ||= 5;
		}
		if (this.recovering && r) {
			let e = this.stoppedAt != null && r[0].pos > this.stoppedAt ? r[0] : this.runRecovery(r, i, n);
			if (e) return z && console.log("Force-finish " + this.stackID(e)), this.stackToTree(e.forceAll());
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
			if (o > -1 && n.length && (!i || (n.prop(P.contextHash) || 0) == a)) return e.useNode(n, o, t), n;
			if (n.children.length == 0 || n.positions[0] > 0) break;
			let s = n.children[0];
			if (s instanceof L && (!r || s.type.id >= this.parser.minRepeatTerm)) n = s;
			else break;
		}
		return null;
	}
	advanceStack(e, t, n) {
		let r = e.pos, { parser: i } = this, a = z ? this.stackID(e) + " -> " : "";
		if (this.stoppedAt != null && r > this.stoppedAt) return e.forceReduce() ? e : null;
		if (this.fragments) {
			let t = e.reducePos < r && e.buffer.length && e.buffer[e.buffer.length - 2] <= e.reducePos && this.fragments.lastRepeatPos == e.reducePos && this.tryReuse(e, e.reducePos, this.fragments.lastRepeat, !0) || this.tryReuse(e, r, this.fragments.nodeAt(r), !1);
			if (t) return z && console.log(a + this.stackID(e) + ` (via reuse of ${i.getName(t.type.id)})`), !0;
		}
		let o = i.stateSlot(e.state, 4);
		if (o > 0) return e.reduce(o), z && console.log(a + this.stackID(e) + ` (via always-reduce ${i.getName(o & 65535)})`), !0;
		if (e.stack.length >= 8400) for (; e.stack.length > 6e3 && e.forceReduce(););
		let s = this.tokens.getActions(e);
		for (let o = 0; o < s.length;) {
			let c = s[o++], l = s[o++], u = s[o++], d = o == s.length || !n, f = d ? e : e.split(), p = this.tokens.mainToken;
			if (f.apply(c, l, p ? p.start : f.pos, u), z && console.log(a + this.stackID(f) + ` (via ${c & 65536 ? `reduce of ${i.getName(c & 65535)}` : "shift"} for ${i.getName(l)} @ ${r}${f == e ? "" : ", split"})`), d) return !0;
			f.pos > r ? t.push(f) : n.push(f);
		}
		return !1;
	}
	advanceFully(e, t) {
		let n = e.pos;
		for (;;) {
			if (!this.advanceStack(e, null, null)) return !1;
			if (e.pos > n) return Ke(e, t), !0;
		}
	}
	runRecovery(e, t, n) {
		let r = null, i = !1;
		for (let a = 0; a < e.length; a++) {
			let o = e[a], s = t[a << 1], c = t[(a << 1) + 1], l = z ? this.stackID(o) + " -> " : "";
			if (o.deadEnd && (i || (i = !0, o.restart(), z && console.log(l + this.stackID(o) + " (restarted)"), this.advanceFully(o, n)))) continue;
			let u = o.split(), d = l;
			for (let e = 0; e < 10 && u.forceReduce() && (z && console.log(d + this.stackID(u) + " (via force-reduce)"), !this.advanceFully(u, n)); e++) z && (d = this.stackID(u) + " -> ");
			for (let e of o.recoverByInsert(s)) z && console.log(l + this.stackID(e) + " (via recover-insert)"), this.advanceFully(e, n);
			this.stream.end > o.pos ? (c == o.pos && (c++, s = 0), o.recoverByDelete(s, c), z && console.log(l + this.stackID(o) + ` (via recover-delete ${this.parser.getName(s)})`), Ke(o, n)) : (!r || r.score < u.score) && (r = u);
		}
		return r;
	}
	stackToTree(e) {
		return e.close(), L.build({
			buffer: je.create(e),
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
		let t = (Ve ||= /* @__PURE__ */ new WeakMap()).get(e);
		return t || Ve.set(e, t = String.fromCodePoint(this.nextStackID++)), t + e;
	}
};
function Ke(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (r.pos == e.pos && r.sameState(e)) {
			t[n].score < e.score && (t[n] = e);
			return;
		}
	}
	t.push(e);
}
var qe = class {
	constructor(e, t, n) {
		this.source = e, this.flags = t, this.disabled = n;
	}
	allows(e) {
		return !this.disabled || this.disabled[e] == 0;
	}
}, Je = class e extends Ee {
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
			typeof e == "string" && (e = P[e]);
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
		this.nodeSet = new ae(t.map((t, i) => F.define({
			name: i >= this.minRepeatTerm ? void 0 : t,
			id: i,
			props: r[i],
			top: n.indexOf(i) > -1,
			error: i == 0,
			skipped: e.skippedNodes && e.skippedNodes.indexOf(i) > -1
		}))), e.propSources && (this.nodeSet = this.nodeSet.extend(...e.propSources)), this.strict = !1, this.bufferLength = N;
		let a = Me(e.tokenData);
		this.context = e.context, this.specializerSpecs = e.specialized || [], this.specialized = new Uint16Array(this.specializerSpecs.length);
		for (let e = 0; e < this.specializerSpecs.length; e++) this.specialized[e] = this.specializerSpecs[e].term;
		this.specializers = this.specializerSpecs.map(Xe), this.states = Me(e.states, Uint32Array), this.data = Me(e.stateData), this.goto = Me(e.goto), this.maxTerm = e.maxTerm, this.tokenizers = e.tokenizers.map((e) => typeof e == "number" ? new Ie(a, e) : e), this.topRules = e.topRules, this.dialects = e.dialects || {}, this.dynamicPrecedences = e.dynamicPrecedences || null, this.tokenPrecTable = e.tokenPrec, this.termNames = e.termNames || null, this.maxNode = this.nodeSet.types.length - 1, this.dialect = this.parseDialect(), this.top = this.topRules[Object.keys(this.topRules)[0]];
	}
	createParse(e, t, n) {
		let r = new Ge(this, e, t, n);
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
				if (n[i + 1] == 1) a = n[i = B(n, i + 2)];
				else if (n[i + 1] == 2) return B(n, i + 2);
				else break;
			}
			if (a == t || a == 0) return B(n, i + 1);
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
				if (this.data[n + 1] == 1) n = B(this.data, n + 2);
				else break;
			}
			r = t(B(this.data, n + 1));
		}
		return r;
	}
	nextStates(e) {
		let t = [];
		for (let n = this.stateSlot(e, 1);; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = B(this.data, n + 2);
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
			return n.specializers[r] = Xe(a), a;
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
		return new qe(e, n, r);
	}
	static deserialize(t) {
		return new e(t);
	}
};
function B(e, t) {
	return e[t] | e[t + 1] << 16;
}
function Ye(e) {
	let t = null;
	for (let n of e) {
		let e = n.p.stoppedAt;
		(n.pos == n.p.stream.end || e != null && n.pos > e) && n.p.parser.stateFlag(n.state, 2) && (!t || t.score < n.score) && (t = n);
	}
	return t;
}
function Xe(e) {
	if (e.external) {
		let t = +!!e.extend;
		return (n, r) => e.external(n, r) << 1 | t;
	}
	return e.get;
}
// src/dsl/grammar/dav.grammar
var Ze = {
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
}, Qe = Je.deserialize({
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
		get: (e) => Ze[e] || -1
	}],
	tokenPrec: 0
}), $e = /* @__PURE__ */ new Set([
	"String",
	"Number",
	"Color",
	"Identifier",
	"Boolean"
]);
function et(e) {
	return Qe.parse(e);
}
function V(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) t.push(n);
	return t;
}
function tt(e) {
	for (let t = e.firstChild; t; t = t.nextSibling) if ($e.has(t.name)) return t;
	return null;
}
function H(e, t) {
	return e.slice(t.from, t.to);
}
function nt(e) {
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
function rt(e) {
	let t = e.startsWith("```"), n = e.length >= (t ? 6 : 3) && e.endsWith("```");
	return v(e.slice(t ? 3 : 0, n ? -3 : void 0));
}
// src/dsl/attributes.ts
var it = {
	string: "\"...\"",
	bool: "true | false",
	color: C.join(" | "),
	stateColor: [...C, T].join(" | "),
	icon: x.join(" | "),
	ident: "identifier"
};
function at(e, t, n) {
	let { value: r, invalid: i } = nt(H(e, t));
	for (let e of i) {
		let r = t.from + e.offset;
		n("invalid-escape", "error", {
			from: r,
			to: r + e.sequence.length
		}, { sequence: e.sequence });
	}
	return r;
}
function ot(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	if (t) {
		let a = O[n], o = /* @__PURE__ */ new Set();
		for (let s of t.getChildren("Attribute")) {
			let t = s.getChild("AttrName"), c = tt(s);
			if (!t || !c) continue;
			let l = H(e, t), u = Object.hasOwn(a, l) ? a[l] : void 0;
			if (!u) {
				r("unknown-attribute", "warning", t, {
					name: l,
					owner: n
				});
				continue;
			}
			o.has(l) && r("duplicate-attribute", "warning", t, { name: l }), o.add(l);
			let d = st(e, l, u, c, r);
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
function st(e, t, n, r, i) {
	let a = H(e, r), o = () => {
		i("invalid-attribute-value", "error", r, {
			name: t,
			expected: it[n]
		});
	};
	switch (n) {
		case "string": return r.name === "String" ? at(e, r, i) : o();
		case "bool": return r.name === "Boolean" ? a === "true" : o();
		case "ident": return r.name === "Identifier" ? a : o();
		case "color":
		case "stateColor": return r.name !== "Identifier" && r.name !== "Color" ? o() : ct(a, r, n === "stateColor", i);
		case "icon": return r.name === "Identifier" ? lt(a, r, i) : o();
	}
}
function ct(e, t, n, r) {
	let i = e.toLowerCase();
	if (w(i)) return i;
	if (n && i === "none") return T;
	r("invalid-color", "error", t, {
		value: e,
		suggestion: (t.name === "Color" ? void 0 : M(e, C)) ?? "",
		names: (n ? [...C, T] : C).join(", ")
	});
}
function lt(e, t, n) {
	let r = e.toLowerCase();
	if (S(r)) return r;
	n("unknown-icon", "error", t, {
		icon: e,
		suggestion: M(e, x) ?? ""
	});
}
// src/dsl/sourceMap.ts
function U(e) {
	return {
		from: e.from,
		to: e.to
	};
}
// src/dsl/analyze.ts
var ut = {
	style: "solid",
	direction: "forward"
};
function dt(e) {
	return new ft(e).run();
}
var ft = class {
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
		let e = et(this.text).topNode;
		this.collectSyntaxErrors(e);
		let t = e.getChild("Header");
		t ? this.readHeader(t) : this.report("missing-header", "error", {
			from: 0,
			to: 0
		});
		for (let t of V(e)) switch (t.name) {
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
			if (t.add(n.from), n.from >= _(this.text).length) {
				if (t.size > 1) continue;
				let e = this.text.length;
				this.report("unexpected-eof", "error", {
					from: e,
					to: e
				});
				continue;
			}
			let e = n.to > n.from ? H(this.text, n) : /^\S+/.exec(this.text.slice(n.from))?.[0] ?? "", r = (e) => (e.length > 24 ? `${e.slice(0, 24)}…` : e).split("\n")[0] ?? "", i = n.node.prevSibling, a = n.node.parent?.name === "Code" && !n.node.parent.getChild("CodeFence") && i?.name === "String" && e.startsWith("\"") && !this.text.slice(i.to, n.from).includes("\n") ? H(this.text, i) : void 0;
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
	readHeader(e) {
		let t = e.getChild("Number");
		if (!t) return;
		let n = H(this.text, t);
		this.doc.version = Number(n), n !== "1" && this.report("unsupported-version", "error", t, { version: n });
	}
	readTitle(e) {
		let t = e.getChild("String");
		t && (this.titleSeen && this.report("duplicate-title", "warning", e), this.titleSeen = !0, this.doc.title = this.readString(t));
	}
	readGroup(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = H(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "group"), a = {
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
			idRange: U(n)
		});
		s && this.doc.groups.push(a);
		let c = e.getChild("GroupBody");
		if (!c) return;
		let l = s ? r : t;
		for (let e of V(c)) e.name === "Group" ? this.readGroup(e, l) : e.name === "Node" && this.readNode(e, l);
	}
	readNode(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = H(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "node"), a = {
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
			idRange: U(n)
		}) && this.doc.nodes.push(a);
	}
	readEdge(e) {
		let t = e.getChildren("Identifier"), n = e.getChild("Arrow"), [r, i] = t;
		if (!r || !i || !n) return;
		let a = H(this.text, r), o = H(this.text, i), s = H(this.text, n), c = j[s] ?? ut;
		a === o && c.direction === "bidirectional" && this.report("invalid-self-arrow", "error", n, {
			arrow: s,
			suggestion: c.style === "dashed" ? "..>" : "-->"
		});
		let l = this.readAttributes(e.getChild("Attributes"), "edge"), u = l.get("id"), d = {
			id: u?.value ?? D(a, o),
			explicitId: u !== void 0,
			from: a,
			to: o,
			style: c.style,
			direction: c.direction,
			visible: l.value("visible") ?? !0
		}, f = this.readChildString(e, "EdgeLabel");
		f !== void 0 && (d.label = f);
		let p = l.value("color");
		p !== void 0 && (d.color = p), u ? this.declare({
			kind: "edge",
			id: d.id,
			from: e.from,
			to: e.to,
			idRange: U(u.node)
		}) : this.elements.has(d.id) ? this.report("duplicate-edge", "error", e, {
			from: a,
			to: o
		}) : this.elements.set(d.id, {
			kind: "edge",
			id: d.id,
			from: e.from,
			to: e.to
		}), this.references.push({
			id: a,
			range: U(r),
			allowed: ["node"]
		}, {
			id: o,
			range: U(i),
			allowed: ["node"]
		}), this.doc.edges.push(d);
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
		for (let e of n ? V(n) : []) switch (e.name) {
			case "Focus":
				for (let n of e.getChildren("Identifier")) {
					let e = H(this.text, n);
					t.focus.push(e), this.references.push({
						id: e,
						range: U(n),
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
		let r = H(this.text, n), i = e.getChild("Attributes"), a = this.readAttributes(i, "state");
		i && i.getChildren("Attribute").length === 0 && this.report("empty-state", "warning", e);
		let o = { target: r }, s = a.value("visible");
		s !== void 0 && (o.visible = s);
		let c = a.value("badge");
		c !== void 0 && (o.badge = c);
		let l = a.value("color");
		l !== void 0 && (o.color = l), t.states.push(o), this.references.push({
			id: r,
			range: U(n),
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
		let a = H(this.text, i), o = j[a] ?? ut;
		o.style === "dashed" ? this.report("invalid-animate-arrow", "error", i, {
			arrow: a,
			suggestion: o.direction === "bidirectional" ? "<->" : "-->"
		}) : o.direction === "bidirectional" && H(this.text, n) === H(this.text, r) && this.report("invalid-self-arrow", "error", i, {
			arrow: a,
			suggestion: "-->"
		});
		let s = this.readAttributes(e.getChild("Attributes"), "animate"), c = {
			from: H(this.text, n),
			to: H(this.text, r),
			direction: o.direction,
			parallel: s.value("parallel") ?? !1
		}, l = this.readChildString(e, "EdgeLabel");
		l !== void 0 && (c.label = l);
		let u = s.value("color");
		u !== void 0 && (c.color = u);
		let d = s.value("icon");
		d !== void 0 && (c.icon = d);
		let f = [], p = s.value("desc");
		p !== void 0 && p.length > 0 && f.push(p);
		let m = e.getChild("AnimateBody");
		f.push(...this.readDescList(m)), f.length > 0 && (c.description = f.join("\n"));
		let h = !1, _, v = s.get("code");
		if (v !== void 0 && (h = !0, g(v.value) || (_ = { body: v.value })), m) for (let e of V(m)) {
			if (e.name !== "Code") continue;
			h && this.report("duplicate-code", "warning", e), h = !0;
			let t = this.readCode(e);
			t !== void 0 && (_ = t);
		}
		_ !== void 0 && (c.code = _), t.animations.push(c), this.references.push({
			id: c.from,
			range: U(n),
			allowed: ["node"]
		}, {
			id: c.to,
			range: U(r),
			allowed: ["node"]
		});
	}
	readCode(e) {
		let t = e.getChild("CodeLang"), n = e.getChild("String"), r = e.getChild("CodeFence"), i, a;
		if (r ? (n && (i = this.readString(n)), a = rt(H(this.text, r))) : n && (a = this.readString(n)), a === void 0 || g(a)) return;
		let o = { body: a };
		return t && (o.lang = H(this.text, t)), i !== void 0 && (o.title = i), o;
	}
	readString(e) {
		return at(this.text, e, this.reportFn);
	}
	readChildString(e, t) {
		let n = (t ? e.getChild(t) : e)?.getChild("String");
		return n ? this.readString(n) : void 0;
	}
	readDescList(e) {
		if (!e) return [];
		let t = [];
		for (let n of V(e)) if (n.name === "Desc") {
			let e = this.readChildString(n);
			e !== void 0 && t.push(e);
		}
		return t;
	}
	readAttributes(e, t) {
		return ot(this.text, e, t, this.reportFn);
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
			let n = k[t.kind];
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
}, pt = A.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
new RegExp(pt), RegExp(`(?:${pt})\\s*\\w*$`), RegExp(`${pt}|^\\s*animate\\b`);
// src/dsl/diagnostics.ts
var mt = {
	ja: {
		"syntax-error": "構文エラー: \"{token}\" は解釈できません{hint}",
		"unexpected-eof": "入力が途中で終わっています（\"}\" や \"]\" の閉じ忘れの可能性があります）",
		"missing-header": "先頭に \"dav 1\" が必要です",
		"unsupported-version": "DSL バージョン {version} には対応していません（対応: 1）",
		"duplicate-title": "title は1回だけ指定できます",
		"duplicate-id": "ID \"{id}\" は既に使われています",
		"duplicate-edge": "\"{from}\" から \"{to}\" へのエッジが重複しています。2本目以降は [id: ...] を指定してください",
		"undefined-reference": "\"{id}\" は定義されていません",
		"reference-kind-mismatch": "\"{id}\" は{actual}です（{expected}を指定してください）",
		"unknown-attribute": "属性 \"{name}\" は{owner}では使えません",
		"duplicate-attribute": "属性 \"{name}\" が重複しています（無視されなかった最後の値が使われます）",
		"invalid-attribute-value": "属性 \"{name}\" の値が不正です（期待: {expected}）",
		"unknown-icon": "アイコン \"{icon}\" は存在しません{suggestion}",
		"invalid-color": "色 \"{value}\" は不正です{suggestion}（使用可: {names}）",
		"invalid-animate-arrow": "animate では点線の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-self-arrow": "自己ループに双方向の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-escape": "エスケープシーケンス \"{sequence}\" は使えません（使用可: \\\" \\\\ \\n \\t）",
		"attribute-not-applicable": "属性 \"{name}\" は{kind}には適用されません",
		"empty-state": "state に属性が指定されていません",
		"duplicate-code": "code は1つの animate に1つだけ指定できます（空でない最後のものが使われます）"
	},
	en: {
		"syntax-error": "Syntax error: unexpected \"{token}\"{hint}",
		"unexpected-eof": "Unexpected end of input (a closing \"}\" or \"]\" may be missing)",
		"missing-header": "The document must start with \"dav 1\"",
		"unsupported-version": "DSL version {version} is not supported (supported: 1)",
		"duplicate-title": "title can only be specified once",
		"duplicate-id": "ID \"{id}\" is already in use",
		"duplicate-edge": "Duplicate edge from \"{from}\" to \"{to}\". Specify [id: ...] for additional edges",
		"undefined-reference": "\"{id}\" is not defined",
		"reference-kind-mismatch": "\"{id}\" is {actual} (expected {expected})",
		"unknown-attribute": "Attribute \"{name}\" is not allowed on {owner}",
		"duplicate-attribute": "Duplicate attribute \"{name}\" (the last value that is not ignored is used)",
		"invalid-attribute-value": "Invalid value for attribute \"{name}\" (expected {expected})",
		"unknown-icon": "Unknown icon \"{icon}\"{suggestion}",
		"invalid-color": "Invalid color \"{value}\"{suggestion}. Use one of: {names}",
		"invalid-animate-arrow": "Dashed arrow \"{arrow}\" cannot be used in animate{suggestion}",
		"invalid-self-arrow": "Bidirectional arrow \"{arrow}\" cannot form a self-loop{suggestion}",
		"invalid-escape": "Invalid escape sequence \"{sequence}\" (allowed: \\\" \\\\ \\n \\t)",
		"attribute-not-applicable": "Attribute \"{name}\" does not apply to {kind}",
		"empty-state": "state has no attributes",
		"duplicate-code": "Only one code block is allowed per animate (the last one that is not empty is used)"
	}
}, ht = {
	ja: {
		node: "ノード",
		group: "グループ",
		edge: "エッジ",
		state: "state",
		animate: "animate"
	},
	en: {
		node: "a node",
		group: "a group",
		edge: "an edge",
		state: "a state",
		animate: "an animate"
	}
}, gt = {
	ja: "（もしかして \"{value}\"？）",
	en: " (did you mean \"{value}\"?)"
};
Object.keys(mt.en);
var _t = {
	ja: { "code-title": "。1行形式の code にはタイトルを付けられません。{title} がタイトルなら消すか、タイトルを残すならコードを ``` の行で囲んでください" },
	en: { "code-title": ". A one-line code takes no title: if {title} is one, remove it, or put the code between lines of ``` to keep it" }
}, vt = /* @__PURE__ */ new Set([
	"owner",
	"kind",
	"actual",
	"expected"
]);
function yt(e, t = "en") {
	return mt[t][e.code].replace(/\{(\w+)\}/g, (n, r) => {
		let i = e.args[r] ?? "";
		return r === "suggestion" ? i ? gt[t].replace("{value}", i) : "" : r === "hint" ? (_t[t][i] ?? "").replace("{title}", () => e.args.title ?? "") : vt.has(r) ? i.split(/\s*\|\s*/).map((e) => ht[t][e] ?? e).join(t === "ja" ? "・" : " or ") : i;
	});
}
// src/dsl/format.ts
var bt = "  ", xt = /* @__PURE__ */ new Set([
	"GroupBody",
	"StepBody",
	"AnimateBody"
]), St = {
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
}, Ct = /* @__PURE__ */ new Set([
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
function wt(e) {
	let t = et(e), n = !1;
	if (t.iterate({ enter: (t) => ((t.type.isError || t.name === "String" && e.slice(t.from, t.to).includes("\n")) && (n = !0), !n) }), n) return e;
	let r = [];
	new Tt(e, r).block(t.topNode, 0);
	let i = e.includes("\r\n") ? "\r\n" : "\n";
	return r.length > 0 ? `${r.join(i)}${i}` : "";
}
var Tt = class {
	text;
	lines;
	constructor(e, t) {
		this.text = e, this.lines = t;
	}
	block(e, t) {
		let n = bt.repeat(t), r = -1, i = !0;
		for (let a of V(e)) {
			let e = a.name === "LineComment";
			if (!e && !Ct.has(a.name)) continue;
			let o = Dt(r >= 0 ? this.text.slice(r, a.from) : "");
			e && r >= 0 && o === 0 ? this.appendToLastLine(` ${H(this.text, a).trimEnd()}`) : (!i && o >= 2 && this.lines.push(""), e ? this.lines.push(n + H(this.text, a).trimEnd()) : this.statement(a, t)), r = a.to, i = !1;
		}
	}
	statement(e, t) {
		let n = bt.repeat(t);
		if (Et(e)) {
			e.name === "Code" ? this.verbatimCode(e, n) : this.verbatim(e, n);
			return;
		}
		if (e.name === "Code") {
			this.code(e, n);
			return;
		}
		let r = Object.hasOwn(St, e.name) ? St[e.name] : void 0;
		if (r) {
			let i = e.getChild(r.body), a = this.inline(e, (e) => !xt.has(e.name)), o = i !== null && V(i).some((e) => e.name !== "{" && e.name !== "}");
			if (!i || !o) {
				this.lines.push(`${n}${a}${r.emptySuffix}`);
				return;
			}
			this.lines.push(`${n}${a} {`), this.block(i, t + 1), this.lines.push(`${n}}`);
		} else this.lines.push(n + this.inline(e, () => !0));
	}
	inline(e, t) {
		let n = [];
		for (let r of V(e)) if (t(r)) switch (r.name) {
			case "Attributes":
				n.push(this.attributes(r));
				break;
			case "EdgeLabel": {
				let e = r.getChild("String");
				n.push(`: ${e ? H(this.text, e) : "\"\""}`);
				break;
			}
			case "Label":
				n.push(H(this.text, r));
				break;
			case ",": {
				let e = n[n.length - 1];
				e !== void 0 && (n[n.length - 1] = `${e},`);
				break;
			}
			default: n.push(H(this.text, r));
		}
		return n.join(" ");
	}
	attributes(e) {
		return `[${e.getChildren("Attribute").map((e) => {
			let t = e.getChild("AttrName"), n = tt(e);
			return `${t ? H(this.text, t) : ""}: ${n ? H(this.text, n) : ""}`;
		}).join(", ")}]`;
	}
	code(e, t) {
		let n = e.getChild("CodeLang"), r = e.getChild("String"), i = e.getChild("CodeFence"), a = ["code"];
		n && a.push(H(this.text, n)), r && a.push(H(this.text, r)), i ? (a.push("```"), this.lines.push(`${t}${a.join(" ")}`), this.fenceBody(i, t)) : this.lines.push(`${t}${a.join(" ")}`);
	}
	verbatimCode(e, t) {
		let n = e.getChild("CodeFence");
		if (!n) {
			this.verbatim(e, t);
			return;
		}
		let r = H(this.text, {
			from: e.from,
			to: n.from
		}).replace(/[^\P{White_Space}\n]*$/u, ""), i = r.endsWith("\n"), a = i ? r.replace(/\r?\n$/, "") : r;
		this.verbatimSpan(a, e.from, t), i ? this.lines.push(`${t}\`\`\``) : this.appendToLastLine(" ```"), this.fenceBody(n, t);
	}
	fenceBody(e, t) {
		let n = rt(H(this.text, e));
		if (n.length > 0) for (let e of n.split("\n")) this.lines.push(e.length > 0 ? `${t}  ${e}` : "");
		this.lines.push(`${t}\`\`\``);
	}
	verbatim(e, t) {
		this.verbatimSpan(H(this.text, e), e.from, t, Ot(e));
	}
	verbatimSpan(e, t, n, r = []) {
		let i = kt(this.lineAt(t)), a = (e) => r.some((t) => e > t.from && e < t.to), o = !0;
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
function Et(e) {
	for (let t of V(e)) if (t.name === "LineComment" || !xt.has(t.name) && Et(t)) return !0;
	return !1;
}
function Dt(e) {
	let t = 0;
	for (let n of e) n === "\n" && t++;
	return t;
}
function Ot(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) n.name === "CodeFence" ? t.push({
		from: n.from,
		to: n.to
	}) : t.push(...Ot(n));
	return t;
}
function kt(e) {
	return /^\s*/.exec(e)?.[0] ?? "";
}
// src/model/zones.ts
function At(e) {
	return new Map(e.map((e) => [e.id, e.parentId]));
}
function W(e) {
	return e.filter((e) => e.parentId === void 0);
}
function jt(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n.id, n.parentId === void 0 ? n.id : t.get(n.parentId) ?? n.id);
	return t;
}
function Mt(e) {
	let t = jt(e.groups);
	return new Map(e.nodes.map((e) => [e.id, e.parentId === void 0 ? void 0 : t.get(e.parentId) ?? e.parentId]));
}
function Nt(e, t) {
	let n = [];
	for (let r = t; r !== void 0; r = e.get(r)) n.push(r);
	return n;
}
var Pt = (e, t) => `${e}\u0000${t}`, G = {
	width: 176,
	height: 118
}, K = {
	x: 40,
	y: 40
}, Ft = {
	width: 160,
	height: 40
}, It = 30, Lt = 18;
function Rt(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.edges) n.from === n.to && t.set(n.from, (t.get(n.from) ?? 0) + 1);
	return new Map([...t].map(([e, t]) => [e, It + (t - 1) * Lt]));
}
function zt() {
	return Object.create(null);
}
function Bt(e) {
	let t = e[0];
	if (!t) return {
		...K,
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
function Vt(e) {
	let t = new Set(e.nodes.map((e) => e.id));
	return e.edges.filter((e) => e.from !== e.to && t.has(e.from) && t.has(e.to)).map((e) => [e.from, e.to]);
}
function Ht(e, t) {
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
function Ut(e, t, n, r, i, a) {
	return Math.sign((n - e) * (a - t) - (r - t) * (i - e));
}
function Wt(e, t) {
	return e.from === t.from || e.from === t.to || e.to === t.from || e.to === t.to;
}
function Gt(e, t) {
	return Ut(e.ax, e.ay, e.bx, e.by, t.ax, t.ay) * Ut(e.ax, e.ay, e.bx, e.by, t.bx, t.by) < 0 && Ut(t.ax, t.ay, t.bx, t.by, e.ax, e.ay) * Ut(t.ax, t.ay, t.bx, t.by, e.bx, e.by) < 0;
}
function Kt(e) {
	let t = 0;
	return e.forEach((n, r) => {
		for (let i = r + 1; i < e.length; i++) {
			let r = e[i];
			r && !Wt(n, r) && Gt(n, r) && t++;
		}
	}), t;
}
function q(e, t) {
	return Kt(Ht(Vt(e), t));
}
// src/layout/ranks.ts
function qt(e, t) {
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
		predecessors: Jt(a),
		back: o
	};
}
function Jt(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of e) for (let e of r) b(t, e, n);
	return t;
}
// src/layout/columns.ts
var Yt = 36, Xt = 32, Zt = 14, Qt = 28, $t = 16, en = 4, tn = 500;
function nn(e, t) {
	let n = At(e.groups), r = At(e.nodes), i = /* @__PURE__ */ new Map();
	for (let t of e.groups) t.parentId && b(i, t.parentId, t.id);
	let a = /* @__PURE__ */ new Map();
	for (let t of e.nodes) t.parentId && b(a, t.parentId, t.id);
	let o = un(e, n), s = Math.max(0, ...Rt(e).values()), c = new Map(e.nodes.map((e) => [e.id, s])), l = qt(e.nodes.map((e) => e.id), e.edges.map((e) => [e.from, e.to]));
	if (t) for (let [e, n] of t) l.rank.has(e) && l.rank.set(e, n);
	let u = rn(e, l.rank, o, i, a), d = e.nodes.length > 0 || o.size > 0 ? sn(e, o, l, u, n, r) : void 0, f = an(e, l.rank, (e) => {
		let t = zt(), n = zt();
		return d && ln(d, l, t, n, c, e), {
			nodes: t,
			placeholders: n
		};
	});
	return {
		nodes: f.nodes,
		groups: dn(e, f.nodes, f.placeholders, c, u, i, a)
	};
}
function rn(e, t, n, r, i) {
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
function an(e, t, n) {
	let r = Vt(e), i = n();
	if (r.length === 0 || r.length > tn) return i;
	let a = (e) => {
		let n = /* @__PURE__ */ new Map(), i = (r, i) => {
			e(t.get(r) ?? 0, t.get(i) ?? 0) && b(n, r, i);
		};
		for (let [e, t] of r) i(e, t), i(t, e);
		return n;
	}, o = a((e, t) => t < e), s = a((e, t) => t > e), c = a(() => !0), l = i, u = on(r, l), d = 0;
	for (let e = 0; e < $t && d < en; e++) {
		i = n({
			previous: i,
			columnNeighbors: e % 2 == 0 ? o : s,
			linked: c
		});
		let t = on(r, i);
		t.crossings < u.crossings || t.crossings === u.crossings && t.length < u.length ? (l = i, u = t, d = 0) : d++;
	}
	return l;
}
function on(e, t) {
	let n = Ht(e, t);
	return {
		crossings: Kt(n),
		length: n.reduce((e, t) => e + Math.abs(t.ay - t.by), 0)
	};
}
function sn(e, t, r, i, a, o) {
	let s = (e) => ({
		id: e,
		nodes: [],
		children: [],
		allNodes: [],
		colSpan: [0, 0],
		needsLayout: !1
	}), c = /* @__PURE__ */ new Map(), l = s(void 0);
	c.set(void 0, l);
	for (let t of e.groups) c.set(t.id, s(t.id));
	for (let t of e.groups) {
		let e = c.get(t.id);
		e && c.get(t.parentId)?.children.push(e);
	}
	for (let t of e.nodes) c.get(o.get(t.id))?.nodes.push(t.id);
	let u = (e) => r.rank.get(e) ?? 0, f = (e) => {
		let n = e.nodes.map(u);
		e.id !== void 0 && t.has(e.id) && n.push(0);
		let r = [...e.nodes], i = !1;
		for (let t of e.children) n.push(...f(t)), r.push(...t.allNodes), t.needsLayout && (i = !0);
		return e.allNodes = r, e.colSpan = n.length === 0 ? [0, 0] : [Math.min(...n), Math.max(...n)], e.needsLayout = e.nodes.length > 0 || e.id !== void 0 && t.has(e.id) || i, n;
	};
	f(l);
	let p = Math.max(0, ...e.nodes.map((e) => u(e.id))), m = Math.max(0, ...e.groups.map((e) => Nt(a, e.id).length)) * 16, h = (e) => (i.endsAt.has(e) ? 16 : 0) + (i.startsAt.has(e + 1) ? 16 : 0), g = /* @__PURE__ */ new Map();
	for (let t of e.edges) {
		if (!t.label || !r.rank.has(t.from) || !r.rank.has(t.to)) continue;
		let e = Math.min(u(t.from), u(t.to));
		if (Math.abs(u(t.from) - u(t.to)) !== 1) continue;
		let i = Math.min(188, d(t.label, n));
		g.set(e, Math.max(g.get(e) ?? 0, i + Xt));
	}
	let _ = /* @__PURE__ */ new Map();
	for (let t of e.edges) t.from !== t.to && r.rank.has(t.from) && r.rank.has(t.to) && (_.set(t.from, (_.get(t.from) ?? 0) + 1), _.set(t.to, (_.get(t.to) ?? 0) + 1));
	let v = new Int32Array(p), y = new Int32Array(p);
	for (let t of e.edges) {
		if (t.from === t.to || !r.rank.has(t.from) || !r.rank.has(t.to)) continue;
		let e = u(t.from), n = u(t.to), i = Math.min(e, n), a = Math.max(e, n), o = a - i >= 2 || (_.get(t.from) ?? 0) >= 4 || (_.get(t.to) ?? 0) >= 4;
		for (let e = i; e < a; e++) y[e] = (y[e] ?? 0) + 1, o && (v[e] = (v[e] ?? 0) + 1);
	}
	let b = [], x = K.x + m;
	for (let e = 0; e <= p; e++) {
		b.push(x);
		let t = (g.get(e) ?? 0) - (G.width - 44), n = Math.max(v[e] ?? 0, (y[e] ?? 0) >= 4 ? y[e] ?? 0 : 0), r = Yt + Math.min(112, Math.max(0, n - 2) * 14);
		x += G.width + Math.max(r, t) + h(e);
	}
	let S = 0;
	for (let t of e.edges) t.from !== t.to && r.rank.has(t.from) && r.rank.has(t.to) && Math.abs(u(t.from) - u(t.to)) >= 2 && S++;
	let C = 0;
	for (let e of _.values()) e >= 5 && C++;
	return {
		root: l,
		columnX: b,
		maxRank: p,
		inset: m,
		rowGap: Zt + Math.min(20, Math.floor((S + C * 2) / 3) * 4)
	};
}
var cn = 34;
function ln(e, t, n, r, i, a) {
	let o = (e) => t.rank.get(e) ?? 0, s = (e) => a?.previous.nodes[e]?.y ?? 0, c = (e) => e.length > 0 ? e.reduce((e, t) => e + s(t), 0) / e.length : void 0, l = (e) => {
		let t = new Set(e), n = e.flatMap((e) => (a?.linked.get(e) ?? []).filter((e) => !t.has(e)));
		return c(n) ?? c(e) ?? Infinity;
	}, u = (e) => {
		if (a) return c(a.columnNeighbors.get(e) ?? []) ?? s(e);
		let r = (t.predecessors.get(e) ?? []).filter((e) => n[e]);
		return r.length > 0 ? r.reduce((e, t) => e + (n[t]?.y ?? 0), 0) / r.length : Infinity;
	}, d = Math.max(0, ...i.values()), f = cn + d, p = (e) => Math.max(0, ...e.children.filter((e) => e.needsLayout).map((e) => 1 + p(e))), m = (t, i) => {
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
				x: e.columnX[r] ?? K.x,
				y: o,
				...G
			}, o += G.height + e.rowGap + d;
			let c = o - e.rowGap - d;
			_[r] = c + Qt, v = Math.max(v, c);
		} else {
			let { child: e, minCol: n, maxCol: r } = t, i = Math.max(..._.slice(n, r + 1)), a = i === g ? i + (h - 1 - p(e)) * f : i, o = m(e, a);
			for (let e = n; e <= r; e++) _[e] = o + Qt + d;
			v = Math.max(v, o);
		}
		return c && v === g && t.id !== void 0 && (r[t.id] = {
			x: e.columnX[0] ?? K.x,
			y: g,
			...Ft
		}, v = g + Ft.height), v + (c ? 16 : 0);
	};
	m(e.root, K.y + e.inset);
}
function un(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of e.nodes) for (let e of Nt(t, r.parentId)) n.add(e);
	return new Set(e.groups.filter((e) => !n.has(e.id)).map((e) => e.id));
}
function dn(e, t, n, r, i, a, o) {
	let s = zt(), c = new Set(e.groups.map((e) => e.id)), l = (e) => {
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
			...K,
			width: 240,
			height: 140
		};
		else {
			let t = Bt(d), n = i.pads.get(e), r = t.x - (n?.left ?? 16), a = t.y - 16 - 18, o = t.x + t.width + (n?.right ?? 16), s = t.y + t.height + 16;
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
// src/layout/straightenNodes.ts
var fn = 60, pn = 12, mn = 14, hn = 28, gn = 4, _n = (e) => ({
	x: e.x + e.width / 2,
	y: e.y + 50
}), vn = (e, t, n) => e.x < t.x + t.width + n && t.x < e.x + e.width + n && e.y < t.y + t.height + n && t.y < e.y + e.height + n;
function yn(e, t) {
	let n = zt();
	for (let [e, r] of Object.entries(t.nodes)) n[e] = { ...r };
	let { groups: r } = t, i = Rt(e), a = new Map(e.nodes.map((e) => [e.id, e.parentId])), o = new Map(e.groups.map((e) => [e.id, e.parentId])), s = Vt(e), c = /* @__PURE__ */ new Map();
	for (let e of s) for (let t of new Set(e)) c.set(t, [...c.get(t) ?? [], e]);
	let l = (e, t) => {
		let n = i.get(e) ?? 0;
		return {
			x: t.x,
			y: t.y - n,
			width: t.width,
			height: t.height + n
		};
	}, u = ([e, t]) => {
		let r = _n(n[e]), i = _n(n[t]);
		return {
			from: e,
			to: t,
			ax: r.x,
			ay: r.y,
			bx: i.x,
			by: i.y
		};
	}, d = (e) => {
		let t = u(e);
		if (Math.abs(t.ay - t.by) > pn && Math.abs(t.ax - t.bx) >= .5) return !1;
		let r = {
			x: Math.min(t.ax, t.bx) - 1,
			y: Math.min(t.ay, t.by) - 1,
			width: Math.abs(t.ax - t.bx) + 2,
			height: Math.abs(t.ay - t.by) + 2
		};
		for (let t in n) if (t !== e[0] && t !== e[1] && vn(n[t], r, 0)) return !1;
		return !0;
	}, f = (e) => [...new Set(e.flatMap((e) => c.get(e) ?? []))], p = (e) => e.filter((e) => d(e)).length, m = (e) => {
		let t = 0;
		for (let n of e) {
			let e = u(n);
			for (let r of s) {
				if (r === n) continue;
				let i = u(r);
				!Wt(e, i) && Gt(e, i) && t++;
			}
		}
		return t;
	}, h = (e, t) => {
		let i = l(e, t), s = a.get(e), c = s ? r[s] : void 0;
		if (c && (i.x < c.x + 16 || i.x + i.width > c.x + c.width - 16 || i.y < c.y + 18 + 16 || i.y + i.height > c.y + c.height - 16)) return !1;
		for (let t in n) if (t !== e && vn(i, l(t, n[t]), mn)) return !1;
		let u = /* @__PURE__ */ new Set();
		for (let e = s; e; e = o.get(e)) u.add(e);
		for (let e in r) if (!u.has(e) && vn(i, r[e], hn)) return !1;
		return !0;
	}, g = (e, t, r) => {
		for (let i of e) {
			let e = n[i];
			e.x += t, e.y += r;
		}
	}, _ = (e, t, r) => {
		let i = e.map((e) => ({ ...n[e] })), a = () => {
			e.forEach((e, t) => {
				n[e] = { ...i[t] };
			});
		}, o = f(e), s = p(o);
		if (g(e, t, r), !e.every((e) => h(e, n[e]))) return a(), 0;
		let c = p(o) - s;
		if (c <= 0) return a(), 0;
		let l = m(o);
		return a(), l > m(o) ? 0 : c;
	}, v = (e, t) => {
		let r = _n(n[e]), i = [e];
		for (let a of c.get(e) ?? []) {
			let o = a[0] === e ? a[1] : a[0], s = _n(n[o]);
			(t === 0 ? Math.abs(s.y - r.y) <= pn : Math.abs(s.x - r.x) < .5) && !i.includes(o) && d(a) && i.push(o);
		}
		return i;
	};
	for (let t = 0; t < gn; t++) {
		let t = !1;
		for (let { id: r } of e.nodes) {
			let e = n[r];
			if (!e) continue;
			let i = [];
			for (let t of c.get(r) ?? []) {
				let a = _n(e), o = _n(n[t[0] === r ? t[1] : t[0]]), s = o.y - a.y, c = o.x - a.x;
				Math.abs(s) > pn && Math.abs(s) <= fn && i.push({
					dx: 0,
					dy: s
				}), Math.abs(c) >= .5 && Math.abs(c) <= fn && i.push({
					dx: c,
					dy: 0
				});
			}
			let a;
			for (let { dx: e, dy: t } of i) {
				let n = v(r, e);
				for (let i of n.length > 1 ? [[r], n] : [[r]]) {
					let n = _(i, e, t), r = Math.abs(e) + Math.abs(t);
					n > 0 && (!a || n > a.gain || n === a.gain && i.length < a.ids.length || n === a.gain && i.length === a.ids.length && r < a.distance) && (a = {
						ids: i,
						dx: e,
						dy: t,
						gain: n,
						distance: r
					});
				}
			}
			a && (g(a.ids, a.dx, a.dy), t = !0);
		}
		if (!t) break;
	}
	return {
		nodes: n,
		groups: r
	};
}
// src/layout/zoneBlocks.ts
var bn = 2, xn = 150, Sn = 44;
function Cn(e) {
	return W(e.groups).length >= bn;
}
var wn = (e, t) => e < t ? Pt(e, t) : Pt(t, e);
function Tn(e, t) {
	let n = 0;
	for (let r of Ht(Vt(e), t)) n += Math.max(0, Math.hypot(r.ax - r.bx, r.ay - r.by) - 700);
	return n;
}
function En(e) {
	return JSON.stringify([
		e.nodes.map((e) => [e.id, e.parentId ?? ""]),
		e.groups.map((e) => [e.id, e.parentId ?? ""]),
		e.edges.map((e) => [e.from, e.to])
	]);
}
function Dn(e) {
	return {
		...e,
		edges: e.edges.map(({ label: e, ...t }) => t)
	};
}
function On(e, t) {
	if (e.parentId !== t) return e;
	let { parentId: n, ...r } = e;
	return r;
}
function kn(e) {
	let t = jt(e.groups), n = Mt(e);
	return new Map(e.nodes.map((e) => {
		let r = n.get(e.id);
		return [e.id, r !== void 0 && t.has(r) ? r : e.id];
	}));
}
function An(e) {
	let t = kn(e);
	return e.edges.filter((e) => {
		let n = t.get(e.from), r = t.get(e.to);
		return n !== void 0 && r !== void 0 && n !== r;
	}).length;
}
function jn(e, t, n, r, i, a) {
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
function Mn(e, t, n, r, i = jt(e.groups), a = kn(e)) {
	let o = e.nodes.filter((e) => a.get(e.id) === t).map((e) => On(e, t)), s = e.groups.filter((e) => e.id !== t && i.get(e.id) === t).map((e) => On(e, t)), c = new Set(o.map((e) => e.id)), l = e.edges.filter((e) => c.has(e.from) && c.has(e.to)), u = Math.max(0, ...Rt({ edges: l }).values()), d = 34 + u, f = (e, n) => [t, {
		x: 0,
		y: 0,
		width: e,
		height: n
	}];
	if (o.length === 0 && s.length === 0) {
		let e = Ft.width + 32, n = d + Ft.height + 16, r = new Map([f(e, n)]);
		return {
			id: t,
			width: e,
			height: n,
			head: d,
			contentHeight: Ft.height,
			flippable: !1,
			nodes: /* @__PURE__ */ new Map(),
			groups: r,
			groupsFlipped: new Map(r),
			reflectConst: /* @__PURE__ */ new Map()
		};
	}
	let p = n({
		...e,
		nodes: o,
		groups: s,
		edges: l,
		steps: []
	}, r), m = Bt([...Object.values(p.nodes), ...Object.values(p.groups)]), h = m.width + 32, g = m.height, _ = d + g + 16, v = (e) => ({
		...e,
		x: e.x - m.x + 16,
		y: e.y - m.y + d
	}), y = new Map(Object.entries(p.nodes).map(([e, t]) => [e, v(t)])), b = new Map([f(h, _), ...Object.entries(p.groups).map(([e, t]) => [e, v(t)])]), { groupsFlipped: x, reflectConst: S } = jn(t, o, s, u, y, b);
	return {
		id: t,
		width: h,
		height: _,
		head: d,
		contentHeight: g,
		flippable: u === 0 && s.length === 0,
		nodes: y,
		groups: b,
		groupsFlipped: x,
		reflectConst: S
	};
}
function Nn(e, t, n) {
	let r = jt(e.groups), i = kn(e), a = [];
	for (let o of W(e.groups)) a.push(Mn(e, o.id, t, n?.get(o.id), r, i));
	for (let t of e.nodes) {
		if (i.get(t.id) !== t.id) continue;
		let { width: e, height: n } = G;
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
			groups: /* @__PURE__ */ new Map(),
			groupsFlipped: /* @__PURE__ */ new Map(),
			reflectConst: /* @__PURE__ */ new Map()
		});
	}
	return {
		blocks: a,
		owners: i
	};
}
function Pn(e, t, n, r) {
	let i = /* @__PURE__ */ new Set(), a = [];
	for (let t of e.edges) {
		let e = n.get(t.from), r = n.get(t.to);
		e && r && e !== r && !i.has(wn(e, r)) && (i.add(wn(e, r)), a.push({
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
	}), s = (e) => o.nodes[e.id]?.x ?? 0, c = (e) => o.nodes[e.id]?.y ?? 0, l = [...new Set(t.map(s))].sort((e, t) => e - t).map((e) => t.filter((t) => s(t) === e).sort((e, t) => c(e) - c(t))), u = (e) => e.reduce((e, t) => e + t.height, 0) + (e.length - 1) * Sn, d = Math.max(...l.map(u)), f = /* @__PURE__ */ new Map(), p = 0;
	for (let e of l) {
		let t = (d - u(e)) / 2;
		for (let n of e) f.set(n.id, {
			x: p,
			y: t
		}), t += n.height + Sn;
		p += Math.max(...e.map((e) => e.width)) + xn;
	}
	return f;
}
function J(e, t, n) {
	let r = e.reflectConst.get(n);
	return r === void 0 ? e.head + e.contentHeight - (t.y - e.head) - t.height : r - t.y - t.height;
}
function Fn(e) {
	let t = [...e].sort((e, t) => e.x - t.x);
	t.forEach((e, n) => {
		for (let r of t.slice(0, n)) e.y < r.y + r.block.height + 34 && r.y < e.y + e.block.height + 34 && (e.x = Math.max(e.x, r.x + r.block.width + 60));
	});
}
function In(e, t, n) {
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
function Ln(e, t, n) {
	let r = At(e.nodes), i = /* @__PURE__ */ new Map();
	for (let [e, n] of t) n.ranks && i.set(e, new Map(Object.entries(n.ranks)));
	let a = Nn(e, n, i).blocks.map((e) => {
		let n = t.get(e.id);
		return n?.order && In(r, e, n.order), {
			block: e,
			x: n?.x ?? 0,
			y: n?.y ?? 0,
			flip: n?.flip ?? 0
		};
	});
	return Fn(a), Rn(a);
}
function Rn(e) {
	let t = Math.min(...e.map((e) => e.x)), n = Math.min(...e.map((e) => e.y)), r = zt(), i = zt();
	for (let a of e) {
		let e = Math.round(a.x - t + K.x), o = Math.round(a.y - n + K.y), { block: s } = a;
		for (let [t, n] of s.nodes) r[t] = {
			...n,
			x: e + n.x,
			y: o + (a.flip ? J(s, n, t) : n.y)
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
// src/layout/zoneCost.ts
var zn = 1.6, Bn = 160, Vn = 2, Hn = 1, Un = 2, Wn = 250, Gn = 130;
function Kn(e, t, n, r, i, a, o, s) {
	let c = n - e, l = r - t;
	for (let n = 1; n < 7; n++) {
		let r = e + c * n / 7, u = t + l * n / 7;
		if (r > i && r < a && u > o && u < s) return !0;
	}
	return !1;
}
function qn(e, t) {
	let n = t.x + t.block.width, r = t.y + t.block.height;
	return e.maxX <= t.x || e.minX >= n || e.maxY <= t.y || e.minY >= r ? !1 : Kn(e.ax, e.ay, e.bx, e.by, t.x, n, t.y, r);
}
function Jn(e) {
	e.ax = e.source.x + e.sourceX, e.ay = e.source.y + e.sourceY[e.source.flip], e.bx = e.target.x + e.targetX, e.by = e.target.y + e.targetY[e.target.flip], e.minX = Math.min(e.ax, e.bx), e.maxX = Math.max(e.ax, e.bx), e.minY = Math.min(e.ay, e.by), e.maxY = Math.max(e.ay, e.by);
}
function Y(e) {
	for (let t of e) Jn(t);
}
function Yn(e) {
	let t = e.open[e.source.flip * 2 + e.target.flip], n = e.bx - e.ax, r = e.by - e.ay, i = Bn;
	return (t & 1 && n > 0 || t & 2 && n < 0) && (i = Math.min(i, Math.abs(r))), (t & 4 && r > 0 || t & 8 && r < 0) && (i = Math.min(i, Math.abs(n))), i;
}
function Xn(e) {
	let t = e.bx - e.ax, n = Math.hypot(t, e.by - e.ay);
	return Yn(e) * Vn + n + Math.max(0, n - 700) + (t < -60 ? 260 - t * .3 : 0);
}
function Zn(e) {
	return Math.max(0, Math.abs(e.by - e.ay) - Math.max(0, e.bx - e.ax));
}
function Qn(e, t) {
	return e.maxX < t.minX || t.maxX < e.minX || e.maxY < t.minY || t.maxY < e.minY ? 0 : !Wt(e, t) && Gt(e, t) ? Wn : 0;
}
var $n = 260, er = 12, tr = 160, nr = 95;
function rr(e, t) {
	let n = t.x, r = n + t.block.width, i = t.y, a = i + t.block.height;
	if (e.maxX <= n || e.minX >= r || e.maxY <= i || e.minY >= a) return 0;
	let o = e.ay > i && e.ay < a, s = e.by > i && e.by < a, c = e.ax > n && e.ax < r, l = e.bx > n && e.bx < r, u = o || l, d = c || s;
	if (u && d) {
		let t = o && s ? 2 * Math.min(Math.min(e.ay, e.by) - i + er, a + er - Math.max(e.ay, e.by)) : 2 * Math.min(Math.min(e.ax, e.bx) - n + er, r + er - Math.max(e.ax, e.bx));
		return $n + Math.max(0, t);
	}
	return u || d ? Kn(e.ax, e.ay, e.bx, e.by, n, r, i, a) ? tr : nr : Kn(e.ax, e.ay, e.bx, e.by, n, r, i, a) ? Gn : 0;
}
function ir(e, t) {
	let n = 0;
	for (let r of t) r !== e.source && r !== e.target && (n += rr(e, r));
	return n;
}
function ar(e) {
	let t = Infinity, n = -Infinity, r = Infinity, i = -Infinity;
	for (let a of e) t = Math.min(t, a.x), n = Math.max(n, a.x + a.block.width), r = Math.min(r, a.y), i = Math.max(i, a.y + a.block.height);
	return {
		width: n - t,
		height: i - r
	};
}
function or(e) {
	let { width: t, height: n } = ar(e), r = (Un - t / Math.max(1, n)) / 1;
	return {
		spread: Math.max(t, n * zn) * 1.2,
		offFlowWeight: Hn * Math.min(1, Math.max(0, r))
	};
}
function X(e, t) {
	let { spread: n, offFlowWeight: r } = or(t), i = n;
	for (let n = 0; n < e.length; n++) {
		let a = e[n];
		if (a) {
			Jn(a), i += Xn(a) + Zn(a) * r + ir(a, t);
			for (let t = 0; t < n; t++) {
				let n = e[t];
				n && (i += Qn(a, n));
			}
		}
	}
	return i;
}
var sr = (e, t, n) => e.source === t || e.target === t || e.source === n || e.target === n;
function cr(e, t, n, r, i) {
	let { spread: a, offFlowWeight: o } = or(t), s = a;
	for (let t = 0; t < e.length; t++) {
		let a = e[t];
		a && (sr(a, n, r) ? i && Jn(a) : (s += rr(a, n), r && (s += rr(a, r))), s += Zn(a) * o);
	}
	for (let i = 0; i < e.length; i++) {
		let a = e[i];
		if (a && sr(a, n, r)) {
			s += Xn(a) + ir(a, t);
			for (let t = 0; t < e.length; t++) {
				let o = e[t];
				o && t !== i && (t > i || !sr(o, n, r)) && (s += Qn(a, o));
			}
		}
	}
	return s;
}
function lr(e, t) {
	for (let n of t) if (n !== e && e.x < n.x + n.block.width + 60 && n.x < e.x + e.block.width + 60 && e.y < n.y + n.block.height + 34 && n.y < e.y + e.block.height + 34) return !1;
	return !0;
}
function Z(e, t, n) {
	for (let r = 0; r < e.length; r++) {
		let i = e[r];
		i && sr(i, t, n) && Jn(i);
	}
}
function ur(e, t, n, r, i, a, o, s = 0, c = 0, l = 0) {
	let u = n.x, d = n.y, f = n.flip, p = o ? o.x : 0, m = o ? o.y : 0, h = o ? o.flip : 0;
	n.x = r, n.y = i, n.flip = a, o && (o.x = s, o.y = c, o.flip = l);
	let g = lr(n, t) && (!o || lr(o, t));
	if (n.x = u, n.y = d, n.flip = f, o && (o.x = p, o.y = m, o.flip = h), !g) return NaN;
	let _ = cr(e, t, n, o, !1);
	return n.x = r, n.y = i, n.flip = a, o && (o.x = s, o.y = c, o.flip = l), cr(e, t, n, o, !0) - _;
}
function dr(e, t, n, r) {
	let i = e.nodes.get(t);
	if (!i) return !1;
	let a = (t, n) => r ? J(e, n, t) : n.y, o = i.x + i.width / 2, s = a(t, i), c = s + 50;
	for (let [r, l] of e.nodes) {
		if (r === t) continue;
		let e = a(r, l), u = c > e && c < e + l.height, d = o > l.x && o < l.x + l.width;
		if (n === 0 && u && l.x > i.x || n === 1 && u && l.x < i.x || n === 2 && d && e > s || n === 3 && d && e < s) return !1;
	}
	return !0;
}
function fr(e, t, n, r) {
	let i = (i, a) => {
		let o = 0;
		for (let [s, c] of [
			[0, 1],
			[1, 0],
			[2, 3],
			[3, 2]
		]) dr(e, t, s, i) && dr(n, r, c, a) && (o |= 1 << s);
		return o;
	};
	return [
		i(0, 0),
		i(0, 1),
		i(1, 0),
		i(1, 1)
	];
}
function pr(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let e of t) for (let [t, r] of e.block.nodes) n.set(t, {
		p: e,
		x: r.x + r.width / 2,
		y: [r.y + 50, J(e.block, r, t) + 50]
	});
	return e.edges.flatMap((e) => {
		let t = n.get(e.from), r = n.get(e.to);
		return !t || !r || t.p === r.p ? [] : [{
			source: t.p,
			target: r.p,
			sourceX: t.x,
			targetX: r.x,
			sourceY: t.y,
			targetY: r.y,
			from: e.from,
			to: e.to,
			open: fr(t.p.block, e.from, r.p.block, e.to),
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
// src/layout/zoneFinish.ts
var mr = [
	128,
	64,
	32,
	16,
	8,
	4
], hr = 4, gr = 8, _r = 140, vr = 30, yr = 120, br = {
	x: {
		across: "y",
		size: "width",
		acrossSize: "height",
		clearance: 60,
		acrossClearance: 34
	},
	y: {
		across: "x",
		size: "height",
		acrossSize: "width",
		clearance: 34,
		acrossClearance: 60
	}
};
function xr(e, t) {
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
function Sr(e, t) {
	let n = X(e, t), r = n, i = (i, a) => {
		let o = i.x, s = i.y;
		if (a.x === o && a.y === s || Math.abs(a.x - o) > _r || Math.abs(a.y - s) > _r) return;
		let c = ur(e, t, i, a.x, a.y, i.flip);
		Number.isNaN(c) || (n + c <= r + vr ? (n += c, r = Math.min(r, n)) : (i.x = o, i.y = s, Z(e, i, void 0)));
	};
	for (let e = 0; e < 3; e++) for (let e of t) for (let n of t) if (e !== n) for (let t of xr(e, n)) i(e, t);
}
function Cr(e, t) {
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
			for (let i of ["x", "y"]) for (let a of mr) for (;;) {
				let o = s[i] - r[i];
				if (Math.abs(o) < a) break;
				let c = r[i], l = c + Math.sign(o) * a, u = ur(e, t, r, i === "x" ? l : r.x, i === "y" ? l : r.y, r.flip);
				if (Number.isNaN(u)) break;
				if (u < 0) n = !0;
				else {
					r[i] = c, Z(e, r, void 0);
					break;
				}
			}
		}
		if (!n) break;
	}
}
function wr(e, t, n) {
	let { across: r, size: i, acrossSize: a, clearance: o, acrossClearance: s } = br[n];
	return e[r] >= t[r] + t.block[a] + s || t[r] >= e[r] + e.block[a] + s || e[n] + e.block[i] <= t[n] ? Infinity : e[n] - (t[n] + t.block[i]) - o;
}
function Tr(e, t, n, r, i, a) {
	let { across: o, acrossSize: s, acrossClearance: c } = br[i], l = r.map((e) => ({
		x: e.x,
		y: e.y
	})), u = (e, t) => {
		r.forEach((n, r) => {
			let a = l[r];
			n[i] = a[i] - e, n[o] = a[o] + t;
		});
	}, d = ar(t), f = () => {
		let { width: e, height: n } = ar(t);
		return e <= d.width && n <= d.height;
	}, p = {
		cost: X(e, t),
		along: 0,
		step: 0
	}, m = (a) => {
		if (u(0, a), a !== 0 && !r.every((e) => lr(e, t))) return;
		let o = Infinity, s;
		for (let e of r) for (let t of n) {
			let n = wr(e, t, i);
			n < o && (o = n, s = {
				stopped: e,
				stopper: t
			});
		}
		if (s) {
			for (let n = o; n >= gr; n /= 2) {
				if (u(n, a), a !== 0 && !f()) continue;
				let r = X(e, t);
				if (r < p.cost) {
					p = {
						cost: r,
						along: n,
						step: a
					};
					break;
				}
			}
			return s;
		}
	}, h = m(0);
	if (h && a) {
		let { stopped: e, stopper: t } = h, n = l[r.indexOf(e)][o];
		m(t[o] + t.block[s] + c - n), m(t[o] - c - e.block[s] - n);
	}
	return u(p.along, p.step), p.along !== 0;
}
function Er(e, t, n) {
	for (let r = 0; r < hr; r++) {
		let r = !1;
		for (let i of ["x", "y"]) {
			let a = [...t].sort((e, t) => e[i] - t[i]);
			for (let o = 1; o < a.length; o++) Tr(e, t, a.slice(0, o), a.slice(o), i, n) && (r = !0);
		}
		if (!r) break;
	}
	Y(e);
}
function Dr(e, t) {
	if (Math.abs(e.ay - e.by) >= .5 && Math.abs(e.ax - e.bx) >= .5) return !1;
	for (let n of t) if (n !== e.source && n !== e.target) {
		if (qn(e, n)) return !1;
	} else for (let [t, r] of n.block.nodes) {
		if (t === e.from || t === e.to) continue;
		let i = n.x + r.x, a = n.y + (n.flip ? J(n.block, r, t) : r.y);
		if (e.maxX > i && e.minX < i + r.width && e.maxY > a && e.minY < a + r.height) return !1;
	}
	return !0;
}
function Or(e, t, n) {
	let r = 0;
	for (let i of e) (!n || i.source === n || i.target === n) && Dr(i, t) && r++;
	return r;
}
function kr(e, t, n = 120) {
	Y(e);
	for (let r = 0; r < 4; r++) {
		let r = !1;
		for (let i of t) {
			let a = i.x, o = i.y, s = Or(e, t, i), c = [];
			for (let t of e) {
				if (t.source !== i && t.target !== i) continue;
				let e = t.source === i ? 1 : -1, n = (t.bx - t.ax) * e, r = (t.by - t.ay) * e;
				r !== 0 && Math.abs(r) <= yr && c.push({
					x: a,
					y: o + r
				}), n !== 0 && Math.abs(n) <= yr && c.push({
					x: a + n,
					y: o
				});
			}
			let l;
			for (let r of c) {
				let c = ur(e, t, i, r.x, r.y, i.flip);
				if (Number.isNaN(c)) continue;
				let u = Or(e, t, i) - s, d = Math.abs(r.x - a) + Math.abs(r.y - o);
				u > 0 && c <= u * n && (!l || u > l.gain || u === l.gain && d < l.reach) && (l = {
					...r,
					gain: u,
					reach: d
				}), i.x = a, i.y = o, Z(e, i, void 0);
			}
			l && (i.x = l.x, i.y = l.y, Z(e, i, void 0), r = !0);
		}
		if (!r) break;
	}
}
// src/layout/zoneAnneal.ts
var Ar = 16e3, jr = [
	11,
	23,
	37,
	53,
	71,
	97
], Mr = 500, Nr = 1.5, Pr = 180, Fr = 20;
function Ir(e) {
	let t = e;
	return () => {
		t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function Lr(e) {
	return e.map((e) => ({
		x: e.x,
		y: e.y,
		flip: e.flip
	}));
}
function Rr(e, t) {
	e.forEach((e, n) => {
		let r = t[n];
		r && (e.x = r.x, e.y = r.y, e.flip = r.flip);
	});
}
function zr(e, t, n) {
	let r = X(e, t), i = r, a = Lr(t), o = Mr, s = (Nr / Mr) ** (1 / Ar);
	for (let c = 0; c < Ar; c++) {
		o *= s;
		let c = t[Math.floor(n() * t.length)];
		if (!c) continue;
		let l = c.x, u = c.y, d = c.flip, f = l, p = u, m = d, h, g = 0, _ = 0, v = 0, y = 0, b = 0, x = 0, S = n();
		if (S < .08 && c.block.flippable) m = +(d === 0);
		else if (S < .2) {
			if (h = t[Math.floor(n() * t.length)], !h || h === c) continue;
			g = h.x, _ = h.y, v = h.flip, f = g, p = _, y = l, b = u, x = v;
		} else {
			let e = 80 + o / Mr * 1500;
			f = l + (n() - .5) * 2 * e, p = u + (n() - .5) * 2 * e;
		}
		let C = ur(e, t, c, f, p, m, h, y, b, x);
		if (!Number.isNaN(C)) {
			if (C <= 0 || n() < Math.exp(-C / o)) {
				if (r += C, r < i) {
					i = r;
					for (let e = 0; e < t.length; e++) {
						let n = t[e], r = a[e];
						n && r && (r.x = n.x, r.y = n.y, r.flip = n.flip);
					}
				}
			} else c.x = l, c.y = u, c.flip = d, h && (h.x = g, h.y = _, h.flip = v), Z(e, c, h);
		}
	}
	Rr(t, a), Y(e);
}
function Br(e) {
	return [...e.entries()].sort((e, t) => e[1].y - t[1].y).map(([e]) => e);
}
function Vr(e, t, n) {
	return new Map(e.map((e) => {
		let r = t.get(e.block.id), i = Br(e.block.nodes), a = r !== void 0 && (i.length !== r.length || i.some((e, t) => e !== r[t])), o = n.get(e.block.id), s = {
			x: e.x,
			y: e.y,
			flip: e.flip
		};
		return a && (s.order = i), o && (s.ranks = o), [e.block.id, s];
	}));
}
function Hr(e, t) {
	let n = Gr(e, t), r = Ur;
	for (let i of jr) {
		let a = Yr(e, t, n, i);
		a.score < r.score && (r = a);
	}
	return r.placement;
}
var Ur = {
	score: Infinity,
	placement: /* @__PURE__ */ new Map()
};
function Wr(e) {
	return {
		...e,
		nodes: new Map([...e.nodes].map(([e, t]) => [e, { ...t }]))
	};
}
function Gr(e, t) {
	let { blocks: n, owners: r } = Nn(e, t), i = Pn(e, n, r, t), a = n.map((e) => ({
		block: e,
		x: 0,
		y: 0,
		flip: 0
	})), o = /* @__PURE__ */ new Map();
	for (let t of e.edges) t.from !== t.to && (b(o, t.from, t.to), b(o, t.to, t.from));
	let s = new Map(n.map((e) => [e.id, Br(e.nodes)])), c = W(e.groups), l = c.length <= Fr, u = /* @__PURE__ */ new Map();
	if (l) {
		let t = new Set(c.map((e) => e.id));
		for (let i of n) {
			if (!t.has(i.id) || i.nodes.size < 2) continue;
			let n = e.nodes.filter((e) => r.get(e.id) === i.id).map((e) => e.id), a = new Set(n), s = e.edges.filter((e) => a.has(e.from) && a.has(e.to) && e.from !== e.to).map((e) => [e.from, e.to]), c = qt(n, s), l = Math.max(0, ...c.rank.values());
			if (l < 1) continue;
			let d = [...new Set([...i.nodes.values()].map((e) => Math.round(e.x)))].sort((e, t) => e - t);
			if (d.length <= l) continue;
			let f = new Map(n.map((e) => [e, []]));
			for (let [e, t] of s) (c.rank.get(e) ?? 0) < (c.rank.get(t) ?? 0) && f.get(e)?.push(t);
			if (!n.some((e) => (c.rank.get(e) ?? 0) < l && (o.get(e) ?? []).some((e) => !a.has(e)))) continue;
			let p = [...n].sort((e, t) => (c.rank.get(t) ?? 0) - (c.rank.get(e) ?? 0));
			u.set(i.id, {
				nodeIds: n,
				idSet: a,
				ranks: c,
				maxRank: l,
				colRelXs: d,
				fwd: f,
				revTopo: p
			});
		}
	}
	return {
		placed: a,
		links: pr(e, a),
		start: i,
		nodeParent: At(e.nodes),
		owners: r,
		zoneOf: jt(e.groups),
		adj: o,
		docLinks: Vt(e),
		baseOrders: s,
		richRefine: l,
		slackMeta: u,
		blockCache: /* @__PURE__ */ new Map()
	};
}
function Kr(e, t, n, r, i, a, o, s, c, l) {
	let u = /* @__PURE__ */ new Map();
	if (c.size === 0) return u;
	let d;
	for (let f of n) {
		let p = f.block.id, m = c.get(p);
		if (!m) continue;
		let { nodeIds: h, idSet: g, ranks: _, maxRank: v, colRelXs: y, fwd: b, revTopo: x } = m, S = Rn(n), C = S.groups[p]?.x ?? f.x, w = (e) => (S.nodes[e]?.x ?? 0) + G.width / 2, T = (e) => {
			let t = new Map(_.rank), n = /* @__PURE__ */ new Map();
			for (let e of h) {
				let r = a.get(e) ?? "", i = n.get(r);
				i || (i = new Int32Array(v + 1), n.set(r, i));
				let o = t.get(e) ?? 0;
				i[o] = (i[o] ?? 0) + 1;
			}
			let r = !1;
			for (let i of x) {
				let s = _.rank.get(i) ?? 0, c = b.get(i) ?? [], l = c.length === 0 ? v : Math.min(v, ...c.map((e) => (t.get(e) ?? v) - 1));
				if (s >= l) continue;
				let u = (o.get(i) ?? []).filter((e) => !g.has(e) && S.nodes[e]);
				if (u.length === 0) continue;
				let d = a.get(i) ?? "", f = n.get(d);
				if (!f) continue;
				f[s] = (f[s] ?? 1) - 1;
				let p = Math.min(...f), m = s, h = Infinity;
				for (let t = s; t <= l; t++) {
					let n = C + y[t] + G.width / 2, r = t * 2;
					for (let e of u) r += Math.abs(n - w(e));
					r += Math.max(0, (f[t] ?? 0) - p) * e, r < h && (h = r, m = t);
				}
				f[m] = (f[m] ?? 0) + 1, m !== s && (t.set(i, m), r = !0);
			}
			return r ? t : void 0;
		}, E = f.block, D = f.x, O = E, k = D, A, j;
		for (let a of [0, 260]) {
			let o = T(a);
			if (!o) continue;
			let s = `${p}|${[...o.entries()].map(([e, t]) => `${e}:${t}`).join(",")}`;
			if (j ||= /* @__PURE__ */ new Set(), j.has(s)) continue;
			if (j.add(s), d === void 0) {
				let t = pr(e, n);
				Y(t), d = X(t, n) + q(e, S) * Pr;
			}
			let c = l.get(s);
			c || (c = Mn(e, p, t, o, i, r), l.set(s, c));
			let u = Wr(c);
			for (let t of /* @__PURE__ */ new Set([D, D + E.width - u.width])) if (f.block = u, f.x = t, lr(f, n)) {
				let r = pr(e, n);
				Y(r);
				let i = X(r, n) + q(e, Rn(n)) * Pr;
				i < d - 1 && (d = i, O = u, k = t, A = o);
			}
			f.block = E, f.x = D;
		}
		if (A) {
			f.block = O, f.x = k, s.set(p, Br(O.nodes));
			let e = {};
			for (let [t, n] of A) n !== (_.rank.get(t) ?? 0) && (e[t] = n);
			u.set(p, e);
		}
	}
	return u;
}
function qr(e, t, n, r, i, a) {
	let o = Infinity, s = Infinity, c = 0;
	for (let t of e) t.x < o && (o = t.x), t.y < s && (s = t.y), c += t.block.nodes.size;
	if (c < 2 || i.length === 0) return !1;
	let l = /* @__PURE__ */ new Map(), u = new Float64Array(c), d = new Float64Array(c), f = new Float64Array(e.length);
	e.forEach((e, t) => {
		let n = Math.round(e.x - o + K.x), r = Math.round(e.y - s + K.y);
		f[t] = r;
		for (let [t, i] of e.block.nodes) {
			let a = l.size;
			l.set(t, a), u[a] = n + i.x + i.width / 2, d[a] = r + (e.flip ? J(e.block, i, t) : i.y) + 50;
		}
	});
	let p = i.length, m = new Int32Array(p), h = new Int32Array(p), g = new Uint8Array(p), _ = new Float64Array(p), v = new Float64Array(p), y = new Float64Array(p), b = new Float64Array(p), x = new Float64Array(p), S = new Float64Array(p), C = new Float64Array(p), w = new Float64Array(p), T = Array.from({ length: c }, () => []), E = 0;
	for (let [e, t] of i) {
		let r = l.get(e), i = l.get(t);
		if (r === void 0 || i === void 0) continue;
		let a = E++;
		m[a] = r, h[a] = i, g[a] = +(n.get(e) === n.get(t));
		let o = u[r], s = u[i], c = d[r], f = d[i];
		_[a] = o, y[a] = s, x[a] = Math.min(o, s), S[a] = Math.max(o, s), v[a] = c, b[a] = f, C[a] = Math.min(c, f), w[a] = Math.max(c, f), T[r]?.push(a), T[i]?.push(a);
	}
	if (E === 0) return !1;
	let D = new Int32Array(E), O = 0, k = [], A = (e) => {
		let t = ++O;
		k.length = 0;
		for (let n = 0; n < e.length; n++) {
			let r = T[e[n]];
			if (r) for (let e = 0; e < r.length; e++) {
				let n = r[e];
				D[n] !== t && (D[n] = t, k.push(n));
			}
		}
		return t;
	}, j = () => {
		for (let e = 0; e < k.length; e++) {
			let t = k[e], n = d[m[t]], r = d[h[t]];
			v[t] = n, b[t] = r, C[t] = Math.min(n, r), w[t] = Math.max(n, r);
		}
	}, M = (e) => {
		let t = 0, n = 0, r = 0;
		for (let i = 0; i < k.length; i++) {
			let o = k[i], s = v[o], c = b[o], l = Math.abs(s - c);
			r += l, a && g[o] === 1 && l >= 1 && (n += .6);
			let u = x[o], d = S[o], f = C[o], p = w[o], T = m[o], O = h[o], A = _[o], j = y[o], M = j - A, ee = c - s;
			for (let n = 0; n < E; n++) {
				if (n === o || D[n] === e && n < o || d <= x[n] || S[n] <= u || p <= C[n] || w[n] <= f) continue;
				let r = m[n], i = h[n];
				if (T === r || T === i || O === r || O === i) continue;
				let a = _[n], l = v[n], g = y[n], E = b[n];
				if (Math.sign(M * (l - s) - ee * (a - A)) * Math.sign(M * (E - s) - ee * (g - A)) >= 0) continue;
				let k = g - a, N = E - l;
				Math.sign(k * (s - l) - N * (A - a)) * Math.sign(k * (c - l) - N * (j - a)) < 0 && t++;
			}
		}
		return {
			cross: t,
			broken: n,
			span: r
		};
	}, ee = new Float64Array(c), N = !1;
	for (let i = 0; i < 4; i++) {
		let i = !1;
		if (e.forEach((e, o) => {
			if (e.block.nodes.size < 2) return;
			ee.set(d);
			let s = f[o], c = (e.flip ? e.block.groupsFlipped : e.block.groups).get(e.block.id), p = c ? s + c.y - 60 : -Infinity, m = c ? s + c.y + c.height + 60 : Infinity, h = /* @__PURE__ */ new Map();
			for (let n of e.block.nodes.entries()) {
				let [e, r] = n, i = `${t.get(e) ?? ""}|${Math.round(r.x)}`, a = h.get(i);
				a ? a.push(n) : h.set(i, [n]);
			}
			for (let t of h.values()) {
				if (t.length < 2) continue;
				let o = new Set(t.map(([e]) => e)), c = t.map(([e]) => l.get(e)), f = t.map(([t, i]) => {
					let s = l.get(t), c = u[s], f = ee[s], h = r.get(t) ?? [], g = 0, _ = 0;
					for (let t of h) {
						if (o.has(t)) continue;
						let r = l.get(t);
						if (r === void 0) continue;
						let i = ee[r];
						if (a) {
							let a = Math.min(m, Math.max(p, i)), o = Math.abs(u[r] - c), s = (n.get(t) === e.block.id ? 2.5 : 1) / Math.max(160, o * .8);
							g += s, _ += a * s;
						} else g += 1, _ += i;
					}
					let v = g > 0 ? _ / g : f;
					return {
						id: t,
						idx: s,
						r: i,
						oldY: i.y,
						cur: d[s],
						target: v
					};
				}), h = t.map(([, e]) => e.y).sort((e, t) => e - t);
				e.flip && h.reverse();
				let g = [...f].sort((e, t) => e.target - t.target || e.cur - t.cur);
				if (!g.every((e, t) => e.oldY === h[t])) {
					let t = A(c);
					if (k.length > 0) {
						let n = M(t);
						g.forEach((t, n) => {
							let r = h[n];
							t.r.y = r, d[t.idx] = s + (e.flip ? J(e.block, t.r, t.id) : r) + 50;
						}), j();
						let r = M(t), a = r.cross - n.cross + (r.broken - n.broken), o = r.span - n.span;
						if (a < -1e-6 || Math.abs(a) <= 1e-6 && o < -.5) i = !0, N = !0;
						else {
							for (let e of f) e.r.y = e.oldY, d[e.idx] = e.cur;
							j();
						}
					}
				}
				if (!a) continue;
				let _ = [...t].sort((t, n) => e.flip ? n[1].y - t[1].y : t[1].y - n[1].y);
				for (let t = 0; t + 1 < _.length; t++) {
					let n = _[t], r = _[t + 1];
					if (!n || !r) continue;
					let [a, o] = n, [c, u] = r, f = l.get(a), p = l.get(c), m = A([f, p]);
					if (k.length === 0) continue;
					let h = M(m), g = o.y, v = u.y, y = d[f], b = d[p];
					o.y = v, u.y = g, d[f] = s + (e.flip ? J(e.block, o, a) : o.y) + 50, d[p] = s + (e.flip ? J(e.block, u, c) : u.y) + 50, j();
					let x = M(m), S = x.cross - h.cross + (x.broken - h.broken), C = x.span - h.span;
					S < -1e-6 || Math.abs(S) <= 1e-6 && C < -.5 ? (_[t] = [c, u], _[t + 1] = [a, o], i = !0, N = !0) : (o.y = g, u.y = v, d[f] = y, d[p] = b, j());
				}
			}
		}), !i) break;
	}
	return N;
}
function Jr(e, t) {
	return e.map((e, n) => {
		let r = t[n] ?? {
			x: e.x,
			y: e.y,
			flip: e.flip
		};
		return {
			block: {
				...e.block,
				nodes: new Map([...e.block.nodes].map(([e, t]) => [e, { ...t }]))
			},
			x: r.x,
			y: r.y,
			flip: r.flip
		};
	});
}
function Yr(e, t, { placed: n, links: r, start: i, nodeParent: a, owners: o, zoneOf: s, adj: c, docLinks: l, baseOrders: u, richRefine: d, slackMeta: f, blockCache: p }, m) {
	for (let e of n) {
		let t = i.get(e.block.id) ?? {
			x: 0,
			y: 0
		};
		e.x = t.x, e.y = t.y, e.flip = 0;
	}
	zr(r, n, Ir(m * 104729)), Cr(r, n);
	let h = Lr(n), g = Ur;
	for (let r of [!1, !0]) {
		let i = Jr(n, h), m = new Map(u), _ = pr(e, i);
		Y(_), Er(_, i, r), Sr(_, i), Cr(_, i), Er(_, i, r);
		let v = Kr(e, t, i, o, s, a, c, m, f, p);
		if (v.size > 0 && (_ = pr(e, i), Y(_), Cr(_, i)), d && i.some((e) => !e.block.flippable && e.block.nodes.size >= 2)) {
			let t = X(_, i) + q(e, Rn(i)) * Pr;
			for (let n of i) {
				if (n.block.flippable || n.block.nodes.size < 2) continue;
				let r = n.flip;
				n.flip = +(r === 0), Z(_, n, void 0);
				let a = X(_, i) + q(e, Rn(i)) * Pr;
				a < t - 1 ? t = a : (n.flip = r, Z(_, n, void 0));
			}
		}
		qr(i, a, o, c, l, d) && (_ = pr(e, i), Y(_)), kr(_, i);
		let y = X(_, i) + q(e, Rn(i)) * Pr - Or(_, i) * 120;
		y < g.score && (kr(_, i, 300), g = {
			score: y,
			placement: Vr(i, m, v)
		});
	}
	return g;
}
// src/layout/index.ts
function Xr(e) {
	let t = Qr(e);
	return yn(e, t ? Ln(e, t, nn) : nn(e));
}
function Zr(e) {
	return Qr(e) !== void 0;
}
function Qr(e) {
	let t = ti(e);
	return t && ni(t.key, ri(t.doc)), Cn(e) ? ei?.placement : void 0;
}
function $r(e) {
	let t = e.nodes.map((e) => e.id), n = e.edges.map((e) => [e.from, e.to]);
	if (!Qr(e)) return qt(t, n).back;
	let r = kn(e);
	return W(e.groups).flatMap((e) => qt(t.filter((t) => r.get(t) === e.id), n).back);
}
var ei;
function ti(e) {
	if (!Cn(e)) return;
	let t = En(e);
	if (ei?.key === t) return;
	let n = Dn(e), r = nn(n);
	if (Tn(n, r) > 0 || q(n, r) > 0) return {
		key: t,
		doc: n,
		links: An(n)
	};
	ei = {
		key: t,
		placement: void 0
	};
}
function ni(e, t) {
	ei = {
		key: e,
		placement: t
	};
}
function ri(e) {
	return ii(e, Hr(e, nn));
}
function ii(e, t) {
	let n = nn(e), r = Ln(e, t, nn), i = (t) => Tn(e, t) + q(e, t) * 700;
	return i(r) < i(n) ? t : void 0;
}
// src/skill/lines.ts
var ai = (e) => e.replace(/\p{Cc}+/gu, (e) => /^\t+$/.test(e) ? e : " "), oi = (e, t) => e.from === t.from && e.to === t.to || e.direction === "bidirectional" && e.from === t.to && e.to === t.from, si = (e) => e.direction === "bidirectional" ? e.style === "dashed" ? "<.>" : "<->" : e.style === "dashed" ? "..>" : "-->", ci = 1, li = (e, t) => `${e} ${t}${e === 1 ? "" : "s"}`;
function ui(e, t) {
	let n = [...new Set(e)].sort((e, t) => e - t), [r = 0] = n, i = n[n.length - 1] ?? r;
	return n.length === 1 ? `${t} ${r}` : i - r + 1 === n.length ? `${t}s ${r} to ${i}` : `${t}s ${n.slice(0, -1).join(", ")} and ${i}`;
}
function di(e) {
	return [...new Set(e.map(Math.round))].sort((e, t) => e - t);
}
function fi(e, t, n, r, i) {
	if (e.length === 0 || t.length === 0) return "";
	let a = e.flatMap((e) => n[t.indexOf(e)] ?? []);
	if (a.length === e.length) return `, ${i} its ${ui(a, r)}`;
	let [o] = e, s = o === void 0 || e.length > 1 ? -1 : t.findIndex((e) => e > o);
	return s > 0 ? `, between its ${r}s ${n[s - 1]} and ${n[s]}` : "";
}
var pi = (e, t) => e.length === 1 && t.length === 1 && e[0] === t[0], mi = (e, t, n, r) => Math.min(e + t, n + r) - Math.max(e, n) >= Math.min(t, r) / 2, hi = (e, t) => mi(e.y, e.height, t.y, t.height), gi = (e, t) => mi(e.x, e.width, t.x, t.width);
function _i(e, t) {
	let { rect: n } = e, r = t.filter((t) => t !== e), i = (e, t) => [...e].sort((e, n) => t(e.rect) - t(n.rect))[0], a = r.filter((e) => hi(n, e.rect)), o = r.filter((e) => gi(n, e.rect)), s = i(a.filter((e) => e.rect.x + e.rect.width <= n.x + ci), (e) => n.x - (e.x + e.width)), c = i(a.filter((e) => e.rect.x >= n.x + n.width - ci), (e) => e.x - (n.x + n.width)), l = i(o.filter((e) => e.rect.y + e.rect.height <= n.y + ci), (e) => n.y - (e.y + e.height)), u = i(o.filter((e) => e.rect.y >= n.y + n.height - ci), (e) => e.y - (n.y + n.height)), d = (t, n) => t.grid ? `${n} ${t.name}${fi(e.ys, t.grid.ys, t.grid.rows, "row", "level with")}` : `${n} ${t.name}${pi(e.ys, t.ys) ? ", level" : ""}`, f = (t, n, r) => t.grid ? `${n} ${t.name}${fi(e.xs, t.grid.xs, t.grid.columns, "column", r)}` : `${pi(e.xs, t.xs) ? "straight " : ""}${n} ${t.name}`, p = [
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
function vi(e, t, n) {
	let r = e.flatMap((e) => {
		let n = t[e.id];
		return n ? [{
			node: e,
			x: Math.round(n.x),
			y: Math.round(n.y)
		}] : [];
	}), i = di(r.map((e) => e.x)), a = di(r.map((e) => e.y)), o = i.map((e) => n.xs.indexOf(e) + 1), s = a.map((e) => n.ys.indexOf(e) + 1), c = new Map(r.map((e) => [e.node.id, o[i.indexOf(e.x)] ?? 0])), l = new Map(r.map((e) => [e.node.id, s[a.indexOf(e.y)] ?? 0])), u = a.map((e) => i.map((t) => {
		let n = r.find((n) => n.x === t && n.y === e);
		return n ? `${n.node.id}${n.node.visible ? "" : " (hidden)"}` : "-";
	})), d = [["column", ...o.map(String)], ...u.map((e, t) => [`row ${s[t]}`, ...e])], f = d[0]?.map((e, t) => Math.max(...d.map((e) => e[t]?.length ?? 0))), p = d.map((e) => e.map((e, t) => e.padEnd(f?.[t] ?? 0)).join(" | ").trimEnd());
	return {
		size: `${li(i.length, "column")} x ${li(a.length, "row")}`,
		lines: p,
		xs: i,
		ys: a,
		columns: o,
		rows: s,
		columnOf: c,
		rowOf: l
	};
}
function yi(e) {
	if (e.nodes.length === 0) return [];
	let t = Xr(e), n = [], r = W(e.groups), i = (e) => `"${e.label || e.id}"`, a = e.nodes.flatMap((e) => t.nodes[e.id] ?? []), o = {
		xs: di(a.map((e) => e.x)),
		ys: di(a.map((e) => e.y))
	};
	if (r.length === 0) {
		let r = vi(e.nodes, t.nodes, o);
		n.push(`no zones, ${r.size}`, ...r.lines.map((e) => `  ${e}`));
	} else {
		n.push(`${li(o.xs.length, "column")} x ${li(o.ys.length, "row")} in all, numbered from the left and from the top across the whole diagram`);
		let a = At(e.groups), s = (t) => e.nodes.filter((e) => Nt(a, e.parentId).includes(t)), c = [...r.flatMap((e) => {
			let n = t.groups[e.id];
			if (!n) return [];
			let r = s(e.id), a = r.length > 0 ? vi(r, t.nodes, o) : void 0;
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
			let t = _i(e, c);
			n.push(`${e.title}${e.grid ? `, ${e.grid.size}` : ""}${t ? `: ${t}` : ""}`);
		}
		for (let t of c) {
			let { grid: r } = t;
			if (t.zone && r) {
				n.push(`nodes of ${t.name} (${t.zone.id}):`), n.push(...r.lines.map((e) => `  ${e}`));
				for (let o of e.groups) {
					if (o.id === t.zone.id || !Nt(a, o.id).includes(t.zone.id)) continue;
					let c = s(o.id).flatMap((e) => r.columnOf.get(e.id) ?? []), l = s(o.id).flatMap((e) => r.rowOf.get(e.id) ?? []);
					if (c.length === 0) continue;
					let u = e.groups.find((e) => e.id === o.parentId), d = u && u.id !== t.zone.id ? i(u) : "it";
					n.push(`  inside ${d}, zone ${i(o)} (${o.id}): ${ui(c, "column")}, ${ui(l, "row")}`);
				}
			}
		}
	}
	let s = Mt(e), c = (t) => {
		let n = e.groups.find((e) => e.id === s.get(t));
		return n ? i(n) : void 0;
	};
	for (let r of e.edges) {
		let [e] = Ht([[r.from, r.to]], t);
		if (r.from === r.to || !e) continue;
		let i = Math.round(e.bx - e.ax), a = Math.round(e.by - e.ay), o = i > 0 ? "right" : "left", s = Math.abs(a) < ci ? `${o}, level` : Math.abs(i) < ci ? `straight ${a > 0 ? "down" : "up"}` : `${a > 0 ? "down" : "up"} and ${o}`, [l, u] = [c(r.from), c(r.to)], d = l === u ? "" : l && u ? `, from ${l} into ${u}` : u ? `, into ${u}` : `, out of ${l}`;
		n.push(`${r.from} ${si(r)} ${r.to}: ${s}${d}`);
	}
	return n;
}
// src/skill/layoutReport.ts
var bi = 4, xi = 1.5, Si = 3, Ci = 5, wi = 10, Ti = (e) => new Set(e.map(Math.round)).size, Ei = (e) => Ti(e.map((e) => e.x)), Di = (e) => Ti(e.map((e) => e.y)), Oi = (e) => `${Ei(e)} x ${Di(e)}`, ki = (e, t) => e >= t ? `${(e / t).toFixed(1)} : 1` : `1 : ${(t / e).toFixed(1)}`;
function Ai(e, t) {
	let n = Mt(e), r = W(e.groups), i = new Map([...r.map((e, t) => [e.id, t]), ...e.nodes.map((e, t) => [e.id, r.length + t])]), a = (e) => i.get(e) ?? 0, o = new Map(r.map((e) => [e.id, `"${e.label || e.id}"`])), s = (e) => o.get(e) ?? e, c = (e) => {
		let [t = "", r = ""] = [n.get(e.from) ?? e.from, n.get(e.to) ?? e.to].sort((e, t) => a(e) - a(t));
		return {
			key: Pt(t, r),
			rank: [a(t), a(r)],
			text: t === r ? s(t) : `${s(t)}–${s(r)}`
		};
	}, l = /* @__PURE__ */ new Map();
	for (let [e, n] of t) {
		let [t, r] = [c(e), c(n)].sort((e, t) => e.rank[0] - t.rank[0] || e.rank[1] - t.rank[1]);
		if (!t || !r) continue;
		let i = Pt(t.key, r.key), a = l.get(i);
		a ? a.count++ : l.set(i, {
			zones: `${t.text} × ${r.text}`,
			count: 1
		});
	}
	return [...l.values()].sort((e, t) => t.count - e.count);
}
function ji(e, t) {
	let n = Mt(e), r = new Map(e.groups.map((e) => [e.id, `"${e.label || e.id}"`])), i = (e) => {
		let t = n.get(e);
		return t === void 0 ? void 0 : r.get(t);
	};
	return e.edges.flatMap((e) => {
		if (e.from === e.to || (n.get(e.from) ?? e.from) === (n.get(e.to) ?? e.to)) return [];
		let [r] = Ht([[e.from, e.to]], t);
		if (!r || Math.round(r.bx - r.ax) > -1) return [];
		let [a, o] = [i(e.from), i(e.to)], s = a && o ? `, from ${a} into ${o}` : o ? `, into ${o}` : a ? `, out of ${a}` : "";
		return [`${e.from} ${si(e)} ${e.to}${s}`];
	});
}
function Mi(e, t) {
	return e.loop.length > 2 || (t.get(e.to) ?? 0) > (t.get(e.from) ?? 0);
}
function Ni(e, t, n) {
	let r = e.edges.find((e) => e.from === t.from && e.to === t.to), i = r ? si(r) : "-->", a = t.root === t.to ? `${t.to}, the node of it declared first` : `${t.to}, from ${t.root}`;
	return `${t.from} ${i} ${t.to} points back, so it does not count for the columns: it closes the loop ${t.loop.join(" → ")}. The layout came into the loop at ${a}, and set it out from left to right in that order: ${t.from} stands at its far end, in column ${n(t.from)}, with ${t.to} in column ${n(t.to)}. To start the loop at another of its nodes, and so stand that node on the left, declare it before ${t.root}.`;
}
function Pi(e) {
	if (e.nodes.length === 0) return {
		summary: [],
		notes: []
	};
	let t = Xr(e), n = (e) => {
		let n = t.nodes[e];
		return n ? [n] : [];
	}, r = e.nodes.flatMap((e) => n(e.id)), i = Bt([...r, ...Object.values(t.groups)]), a = Math.round(i.width), o = Math.round(i.height), s = Ht(Vt(e), t), c = s.flatMap((e, t) => s.slice(t + 1).filter((t) => !Wt(e, t) && Gt(e, t)).map((t) => [e, t])), l = (t) => {
		let n = e.edges.find((e) => e.from === t.from && e.to === t.to);
		return `${t.from} ${n ? si(n) : "-->"} ${t.to}`;
	}, u = c.map(([e, t]) => `${l(e)} and ${l(t)}`), d = u.length, f = [`layout: ${a} x ${o} (${ki(a, o)}), ${Ei(r)} columns x ${Di(r)} rows of nodes, ${d} ${d === 1 ? "crossing" : "crossings"}`], p = At(e.groups), m = (t) => e.nodes.filter((e) => Nt(p, e.parentId).includes(t)), h = W(e.groups).map((e) => ({
		g: e,
		rects: m(e.id).flatMap((e) => n(e.id))
	})).filter(({ rects: e }) => e.length > 0), g = h.length > 0 && Zr(e);
	if (h.length > 0 && f.push(`layout: zones ${g ? "placed freely" : "in shared columns"}, as columns x rows of nodes: ${h.map(({ g: e, rects: t }) => `"${e.label || e.id}" ${Oi(t)}`).join(", ")}`), h.length > 0 && d > 0) {
		let t = Ai(e, c), n = t.slice(wi), r = n.reduce((e, { count: t }) => e + t, 0), i = `${t.slice(0, wi).map(({ zones: e, count: t }) => `${e} ${t}`).join(", ")}${n.length > 0 ? `, and ${r} more in ${n.length} other pairs` : ""}`;
		f.push(`layout: crossings by the zones the two connections join, "A" for one inside a zone and "A"–"B" for one between two: ${i}`);
	}
	let _ = [];
	o > a * xi && _.push({
		code: "tall-diagram",
		message: `The diagram is ${(o / a).toFixed(1)} times as tall as it is wide. Nodes that no edge puts in order are stacked in one column: where one of them really feeds another, declare that edge, and it moves to the right.`
	});
	for (let t of e.groups) {
		let r = e.nodes.filter((e) => e.parentId === t.id).flatMap((e) => n(e.id));
		r.length >= bi && Ei(r) === 1 && _.push({
			code: "stacked-zone",
			message: `Zone "${t.label || t.id}" stacks its ${r.length} nodes in one column, because no edge runs between them. That is right for peers, such as replicas, separate stores, outside services or people, and the note can then be left. If one of them feeds another, declare that edge, and they spread to the right.`
		});
	}
	let v = [...new Set(r.map((e) => Math.round(e.x)))].sort((e, t) => e - t), y = (e) => v.indexOf(Math.round(t.nodes[e]?.x ?? NaN)) + 1, b = new Map(e.nodes.map((e, t) => [e.id, t])), x = /* @__PURE__ */ new Set();
	for (let t of $r(e)) {
		let n = Pt(t.from, t.to);
		!x.has(n) && Mi(t, b) && (x.add(n), _.push({
			code: "back-edge",
			message: Ni(e, t, y)
		}));
	}
	let S = g ? ji(e, t) : [];
	if (S.length > 0) {
		let e = S.length;
		_.push({
			code: "left-links",
			message: `${e === 1 ? "One connection between zones points" : `${e} connections between zones point`} left, against the reading direction: ${S.slice(0, Ci).join("; ")}${e > Ci ? "; and more" : ""}. The zones are placed freely, and a link between zones sets no column. Leave a link whose edge is written as you mean: pointing left is the price of shorter links that cross less. Change only an edge written other than you mean, such as a call back written one way, which becomes one two-way edge that names the node on the left first. references/large-diagrams.md has more.`
		});
	}
	return d > 0 && _.push({
		code: "crossings",
		message: `${d === 1 ? "One pair of connections crosses" : `${d} pairs of connections cross`}, counted on straight lines between the nodes: ${u.slice(0, Si).join("; ")}${d > Si ? "; and more" : ""}. Swapping the declarations of two nodes that share a column often removes a crossing. In a large diagram, leave the rest once the zones stand in the order you mean; references/layout.md has more.`
	}), {
		summary: f,
		notes: _
	};
}
var Fi = (e) => e === " " || e === "\n" || p(e) || e === "—" || e === "→" || e === "←" || e === "↔" || e === "・";
function Ii(e) {
	if (e >= "ぁ" && e <= "ゟ") return "hiragana";
	if (e >= "ァ" && e <= "ヿ" && e !== "・") return "katakana";
	if (e >= "一" && e <= "鿿" || e >= "㐀" && e <= "䶿" || e === "々") return "kanji";
}
var Li = /* @__PURE__ */ new Set([..."をにへがはのとでもやか"]), Ri = 12, zi = /^[([{（「『【〈《〔]+$/, Bi = /^(.+?)([([{（「『【〈《〔]+)$/, Vi = /^[)\]}）」』】〉》〕。、，．・：；！？…‥ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]+/, Hi = (e) => e === " " || e === "\n";
function Ui(e) {
	let t = e.flatMap((t, n) => {
		let r = e[n + 1];
		if (r !== void 0 && !Hi(r) && !zi.test(t)) {
			let e = Bi.exec(t);
			if (e?.[1] && e[2]) return [e[1], e[2]];
		}
		return [t];
	}), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		t !== void 0 && !Hi(t) && !Hi(e) && Vi.test(e) ? n[n.length - 1] = t + e : n.push(e);
	}
	let r = [], i = "";
	for (let e of n) zi.test(e) ? i += e : i ? (Hi(e) ? r.push(i, e) : r.push(i + e), i = "") : r.push(e);
	return i && r.push(i), r;
}
function Q(e, t, n, r = "normal", i = d) {
	if (i(e, t, r) <= n) return e;
	let a = "";
	for (let o of e) {
		if (i(`${a + o}…`, t, r) > n) break;
		a += o;
	}
	return `${r === "mono" ? a : a.trimEnd()}…`;
}
function Wi(e, t, n, r = 3, i = "normal", a = d) {
	let o = e.trim().replace(/\s*\n\s*/g, "\n").replace(/[^\S\n]+/g, " ");
	if (!o) return [];
	let s = [], c = "", l, u = 0, f = 0, p = "", m = () => {
		c && s.push(c), c = "", u = 0;
	};
	for (let e of o) {
		let r = Ii(e);
		if (r) {
			let o = r === "kanji" && l === "hiragana" && f === 1 && !Li.has(p);
			(l === "other" || u >= Ri || a(c + e, t, i) > n || r === "kanji" && l !== "kanji" && !o || r === "katakana" && l !== "katakana") && m(), c += e, u++, f = r === "hiragana" ? l === "hiragana" ? f + 1 : l === "kanji" ? 1 : 2 : 0, p = e, l = r;
		} else Fi(e) ? (m(), s.push(e), l = void 0) : (l !== "other" && m(), c += e, l = "other");
	}
	m();
	let h = Ui(s), g = [], _ = "";
	for (let e = 0; e < h.length; e++) {
		let o = h[e] ?? "";
		if (!_ && o === " ") continue;
		let s = _ + o;
		if (o === "\n" || _ && a(s, t, i) > n) {
			if (g.length + 1 >= r) {
				let r = (_ + h.slice(e).join("")).trim().replace(/\n/g, " ");
				return g.push(Q(r, t, n, i, a)), g;
			}
			g.push(Q(_.trimEnd(), t, n, i, a)), _ = o === " " || o === "\n" ? "" : o;
		} else _ = s;
	}
	return _.trim() && g.push(Q(_.trim(), t, n, i, a)), g;
}
// src/scene/calloutMeasure.ts
var $ = d, Gi = 14, Ki = 16, qi = 414, Ji = 180, Yi = 2, Xi = 4, Zi = 4, Qi = 202, $i = {
	withLabel: 54,
	bare: 26
}, ea = 18, ta = 15, na = 12.5, ra = 440, ia = 15;
function aa(e) {
	let t = v(e.body, { stripAllOuterBlankLines: !0 });
	if (!t) return;
	let n = t.split("\n"), r = (n.length > 10 ? [...n.slice(0, 9), "…"] : n).map((e) => Q(e, na, ra, "mono", $)), i = e.lang?.trim() ?? "", a = e.title?.trim() ?? "", o = i && a ? `${i} · ${a}` : i || a, s = o ? Q(o, na, 412, "mono", $) : "", c = s ? 30 : 0, l = (e) => $(e, na, "mono");
	return {
		header: s,
		headerHeight: c,
		lines: r,
		minBoxW: Math.max(s ? l(`{ } ${s}`) : 0, ...r.map(l)) + Xi + 26,
		height: c + 21 + (r.length - 1) * 19 + ia
	};
}
function oa(e) {
	let t = 0;
	for (let n of e) n === "…" && t++;
	return t;
}
function sa(e, t, n) {
	let r = Wi(e, 14, t, Zi, "normal", $), i = r.length;
	if (e.includes("\n") || i < 2) return r;
	let a = oa(e);
	if (oa(r.join("")) > a || n >= t) return r;
	let o = r, s = n, c = t;
	for (let t = 0; t < 8; t++) {
		let t = (s + c) / 2, n = Wi(e, 14, t, Zi, "normal", $);
		n.length <= i && oa(n.join("")) <= a ? (o = n, c = t) : s = t;
	}
	return o;
}
var ca = .25;
function la(e, t) {
	let n = Wi(e, 14, t, Zi, "normal", $);
	if (n.length < 2 || e.includes("\n")) return n;
	let r = (e) => $(e[e.length - 1] ?? "", 14, "normal") < ca * t;
	if (!r(n)) return n;
	let i = oa(e);
	for (let a = t - 6; a >= Math.max(Qi, t * .55); a -= 6) {
		let t = Wi(e, 14, a, Zi, "normal", $);
		if (t.length !== n.length || oa(t.join("")) > i) break;
		if (!r(t)) return t;
	}
	return n;
}
var ua = (e) => e.reduce((e, t) => Math.max(e, $(t, 14, "normal")), 0);
function da(e, t, n) {
	let r = t > 0 ? (e ? $i.withLabel : $i.bare) + (t - 1) * 22 : e ? 27 : void 0;
	if (n === void 0) return {
		offsetY: 0,
		height: t === 0 ? 36 : (r ?? 0) + ea
	};
	let i = r === void 0 ? Ki : r + ta;
	return {
		offsetY: i,
		height: i + n + Ki
	};
}
function fa(e) {
	let t = pa(e), n = e.code ? v(e.code.body, { stripAllOuterBlankLines: !0 }).split("\n") : [], r = t?.code?.lines ?? [], i = n.length > 10;
	return {
		label: !!e.label && t?.label !== e.label,
		description: oa((t?.descLines ?? []).join("")) > oa(e.description ?? ""),
		codeLines: i ? n.length : 0,
		wideCodeLines: n.flatMap((e, t) => t < r.length - +!!i && r[t] !== e ? [t + 1] : [])
	};
}
function pa(e) {
	let t = e.code ? aa(e.code) : void 0, n = e.label ? Q(e.label, 15, qi, "bold", $) : "", r = n ? $(n, 15, "bold") : 0, i = e.stopLabel === void 0 ? 0 : 28, a = n ? 0 : i, o = n ? i + r + Yi : 0, s = Math.max(o, t ? t.minBoxW : 0), c = e.description || t !== void 0 ? 16 : Gi, l = (e) => Math.max(t ? Ji : e.length > 0 ? 210 : 60, Math.ceil(Math.max(s, e.length > 0 ? ua(e) + Yi : 0) + c * 2)) + a, u = [];
	if (e.description) {
		let t = Math.max(qi, s - Yi);
		u = sa(e.description, t, Qi), u = la(e.description, Math.max(s, ua(u) + Yi) - Yi);
	}
	if (!n && u.length === 0 && !t) return null;
	let { offsetY: d, height: f } = da(n !== "", u.length, t?.height), p = l(u), m = {
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
var ma = (e, t, n, r) => Q(e, t, n, r) !== e;
function ha(e) {
	let t = [], n = G.width;
	for (let r of e.nodes) ma(r.label, 14, n, "bold") && t.push({
		kind: "node-label",
		node: r.id,
		text: r.label
	}), r.sub && ma(r.sub, 11.5, n) && t.push({
		kind: "node-sub",
		node: r.id,
		text: r.sub
	}), r.badge && ma(r.badge, 11, 120, "bold") && t.push({
		kind: "node-badge",
		node: r.id,
		text: r.badge
	});
	for (let n of e.edges) n.label && ma(n.label, 11.5, 188) && t.push({
		kind: "edge-label",
		id: n.id,
		from: n.from,
		to: n.to,
		text: n.label
	});
	for (let n of e.steps) {
		for (let e of n.states) e.badge && ma(e.badge, 11, 120, "bold") && t.push({
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
			}, i = fa(e);
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
// src/skill/review.ts
var ga = 3, _a = (e) => `step ${e.index + 1} "${e.title}"`, va = (e) => `animate ${e.from} ${e.direction === "bidirectional" ? "<->" : "-->"} ${e.to}`, ya = 4;
function ba(e, t, n, r) {
	let i = /* @__PURE__ */ new Map([[t, t]]), a = [t];
	for (let t = a.shift(); t !== void 0 && t !== n; t = a.shift()) for (let n of e.edges) {
		if (n.from === n.to) continue;
		let e = n.from === t ? n.to : n.to === t && (r || n.direction === "bidirectional") ? n.from : void 0;
		e === void 0 || i.has(e) || (i.set(e, t), a.push(e));
	}
	if (!i.has(n)) return;
	let o = [n];
	for (; o[0] !== t;) o.unshift(i.get(o[0] ?? t) ?? t);
	return o.length - 1 <= ya ? o : void 0;
}
function xa(e, t) {
	let n = (e) => e.slice(1).map((t, n) => `animate ${e[n]} --> ${t}`).join(", then "), r = t.direction === "bidirectional" ? ", and the answer back the same way" : "", i = ba(e, t.from, t.to, !1);
	if (i) return `The edges join them by way of ${i.slice(1, -1).join(", ")}: send ${n(i)} instead${r}.`;
	let a = ba(e, t.from, t.to, !0);
	if (a) {
		let t = a.slice(1).map((e, t) => ({
			from: a[t] ?? "",
			to: e
		})).filter((t) => !e.edges.some((e) => oi(e, t))).map((e) => `${e.to} --> ${e.from}`);
		return a.length === 2 ? `The edge ${t[0]} runs the other way: make it <-> so that the packet can ride it back.` : `The edges on the way run the other way (${t.join(", ")}): make each of those edges <->, then send ${n(a)} instead${r}.`;
	}
	return `No edges join the two. If the code shows that they talk to each other directly, declare ${t.from} --> ${t.to} : "..."; if it does not, leave the packet out.`;
}
function Sa(e, t) {
	let n = "step" in e ? t.steps[e.step] : void 0, r = n ? `${_a(n)}: ` : "";
	switch (e.kind) {
		case "node-label": return `The label of node ${e.node} is too long for its place and is cut off: "${e.text}". Shorten it, and move detail into sub.`;
		case "node-sub": return `The sub of node ${e.node} is too long and is cut off: "${e.text}". Shorten it.`;
		case "node-badge": return `The badge of node ${e.node} is too long and is cut off: "${e.text}". A badge is a word or two.`;
		case "state-badge": return `${r}the badge set on ${e.target} is too long and is cut off: "${e.text}". A badge is a word or two.`;
		case "edge-label": {
			let n = t.edges.find((t) => t.id === e.id);
			return `The label of ${e.from} ${n ? si(n) : "-->"} ${e.to} is too long and is cut off: "${e.text}". Shorten it.`;
		}
		case "packet-label": return `${r}the label of the packet from ${e.from} to ${e.to} is too long and is cut off: "${e.text}". Keep the label short, and move the rest into desc.`;
		case "packet-desc": return `${r}the desc of the packet from ${e.from} to ${e.to} is longer than the four lines a callout shows, and is cut off. Shorten it to one or two sentences.`;
		case "code-lines": return `${r}the code of the packet from ${e.from} to ${e.to} has ${e.lines} lines, and a callout shows 10. Keep the lines that matter.`;
		case "code-width": return `${r}line ${e.line} of the code of the packet from ${e.from} to ${e.to} is too wide and is cut off. Break it, or shorten it to about 55 characters, or 35 Japanese ones.`;
	}
}
function Ca(e) {
	let t = [], n = (e, n) => {
		t.push({
			code: e,
			message: n
		});
	};
	for (let t of e.edges) t.label || n("edge-without-label", `${t.from} ${si(t)} ${t.to} has no label. Say what travels on it or how the two are related, such as : "HTTPS".`);
	for (let t of e.steps) {
		t.description.trim() || n("step-without-desc", `${_a(t)} has no desc. Add one or two sentences that say what happens in it and why.`), t.animations.length === 0 && t.states.length === 0 && t.focus.length === 0 && n("empty-step", `${_a(t)} shows nothing: it has no animate, state or focus.`);
		for (let r of t.animations) e.edges.some((e) => oi(e, r)) || n("animate-without-edge", r.from === r.to ? `${_a(t)}: ${va(r)} loops on a node that has no loop edge. Declare it: ${r.from} --> ${r.to} : "...".` : `${_a(t)}: ${va(r)} travels where no edge is declared, so it has no line to follow. ${xa(e, r)}`), r.label || n("animate-without-label", `${_a(t)}: ${va(r)} has no label. Name what is sent, such as : "POST /orders".`), r.description?.trim() || n("animate-without-desc", `${_a(t)}: ${va(r)} has no desc. Add [desc: "..."] that says what this message does or decides.`);
	}
	let r = e.steps.flatMap((e) => e.animations);
	r.length >= ga && !r.some((e) => e.code?.body.trim()) && n("no-code", "No animate shows a code block. Attach the request, query, event or response that matters most to one to three of them.");
	for (let t of ha(e)) n("text-cut", Sa(t, e));
	return t;
}
// src/skill/check.ts
var wa = "Usage: node dav-check.mjs [--write] [--detail] [--map] <file.dav>...", Ta = [
	"--write",
	"--detail",
	"--map"
], Ea = 0, Da = 1, Oa = 2;
function ka(e, t) {
	let n = Number.isNaN(t) ? 0 : Math.max(0, Math.min(e.length, Math.trunc(t))), r = n === 0 ? 1 : n - e.lastIndexOf("\n", n - 1);
	return `${y(e, n)}:${r}`;
}
function Aa(e, t, n) {
	return ai(`${e}:${ka(t, n.from)}: ${n.severity} ${n.code}: ${yt(n)}`);
}
function ja(n, r, i, a) {
	let o = e(n, "utf8").replace(/^﻿/, "");
	if (r) {
		let e = wt(o);
		e !== o && (t(n, e), o = e);
	}
	let { document: s, diagnostics: c } = dt(o), l = (e) => console.log(ai(e));
	for (let e of c) l(Aa(n, o, e));
	let u = i && c.length === 0 ? Ca(s) : [];
	for (let e of u) l(`${n}: hint ${e.code}: ${e.message}`);
	if (i && c.length === 0) {
		let { summary: e, notes: t } = Pi(s);
		for (let t of e) l(`${n}: ${t}`);
		for (let e of t) l(`${n}: note ${e.code}: ${e.message}`);
	}
	if (a && c.length === 0) for (let e of yi(s)) l(`${n}: map: ${e}`);
	if (c.length === 0 && u.length === 0) {
		let { nodes: e, edges: t, steps: r } = s;
		l(`${n}: ok (${e.length} nodes, ${t.length} edges, ${r.length} steps)`);
	}
	return c.length === 0 && u.length === 0;
}
function Ma(e, t = wa) {
	if (e.includes("--help") || e.includes("-h")) return console.log(t), Ea;
	let n = e.filter((e) => !Ta.includes(e));
	if (n.length === 0 || n.some((e) => e.startsWith("-"))) return console.error(t), Oa;
	let r = !0;
	for (let t of n) try {
		let n = (t) => e.includes(t);
		ja(t, n("--write"), n("--detail"), n("--map")) || (r = !1);
	} catch (e) {
		return console.error(`${t}: ${e instanceof Error ? e.message : String(e)}`), Oa;
	}
	return r ? Ea : Da;
}
// src/skill/checkEntry.ts
process.exitCode = Ma(process.argv.slice(2));
