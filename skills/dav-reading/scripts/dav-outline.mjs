// Generated from apps/vscode/src/skill/outlineEntry.ts. Do not edit.
import { readFileSync as e } from "node:fs";
// src/model/text.ts
var t = /\p{White_Space}+$/u, n = /\P{White_Space}/u;
function r(e) {
	return !n.test(e);
}
function i(e) {
	return e.replace(t, "");
}
function a(e, t) {
	let n = e.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n"), a = (e) => e !== void 0 && r(e);
	if (t?.stripAllOuterBlankLines) {
		for (; a(n[0]);) n.shift();
		for (; a(n[n.length - 1]);) n.pop();
	} else n.length > 1 && (a(n[0]) && n.shift(), a(n[n.length - 1]) && n.pop());
	let o = n.map(i), s = Infinity;
	for (let e of o) {
		if (e.length === 0) continue;
		let t = /^ */.exec(e)?.[0].length ?? 0;
		t < s && (s = t);
	}
	return !Number.isFinite(s) || s === 0 ? o.join("\n") : o.map((e) => e.length > 0 ? e.slice(s) : "").join("\n");
}
// src/model/types.ts
var o = /* @__PURE__ */ "server.container.function.runtime.database.cache.queue.storage.lb.firewall.cdn.cloud.building.router.hub.wifi.external.auth.ai.api.mail.monitor.schedule.search.logic.webhook.payment.key.dns.shield.stream.event.nat.registry.warehouse.vault.audit.gateway.endpoint.nosql.workflow.pipeline.alert.region.network.account.screen.modal.browser.desktop.mobile.terminal.device.printer.chat.sheet.file.user.users.bot".split(".");
function s(e) {
	return o.includes(e);
}
var c = [
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
function l(e) {
	return c.includes(e);
}
var u = "none", d = [
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
], f = ["solid", "dashed"];
function p(e) {
	return f.includes(e);
}
var m = ["border"];
function h(e) {
	return m.includes(e);
}
function g(e, t) {
	return `${e}->${t}`;
}
var _ = {
	node: {
		icon: "icon",
		sub: "string",
		badge: "string",
		visible: "bool",
		color: "color",
		mount: "mount"
	},
	group: {
		icon: "icon",
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
}, v = {
	node: /* @__PURE__ */ new Set([
		"badge",
		"visible",
		"color"
	]),
	group: /* @__PURE__ */ new Set(["color"])
}, y = [
	"-->",
	"..>",
	"<->",
	"<.>"
], b = {
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
new Set(d);
// src/dsl/suggest.ts
function x(e, t) {
	let n, r = 3, i = e.toLowerCase();
	for (let e of t) {
		let t = e.length <= 3 ? 1 : 2, a = S(i, e);
		a <= t && a < r && (n = e, r = a);
	}
	return n;
}
function S(e, t) {
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
var C = 1024, w = 0, T = class {
	constructor(e, t) {
		this.from = e, this.to = t;
	}
}, E = class {
	constructor(e = {}) {
		this.id = w++, this.perNode = !!e.perNode, this.deserialize = e.deserialize || (() => {
			throw Error("This node type doesn't define a deserialize function");
		}), this.combine = e.combine || null;
	}
	add(e) {
		if (this.perNode) throw RangeError("Can't add per-node props to node types");
		return typeof e != "function" && (e = k.match(e)), (t) => {
			let n = e(t);
			return n === void 0 ? null : [this, n];
		};
	}
};
E.closedBy = new E({ deserialize: (e) => e.split(" ") }), E.openedBy = new E({ deserialize: (e) => e.split(" ") }), E.group = new E({ deserialize: (e) => e.split(" ") }), E.isolate = new E({ deserialize: (e) => {
	if (e && e != "rtl" && e != "ltr" && e != "auto") throw RangeError("Invalid value for isolate: " + e);
	return e || "auto";
} }), E.contextHash = new E({ perNode: !0 }), E.lookAhead = new E({ perNode: !0 }), E.mounted = new E({ perNode: !0 });
var D = class {
	constructor(e, t, n, r = !1) {
		this.tree = e, this.overlay = t, this.parser = n, this.bracketed = r;
	}
	static get(e) {
		return e && e.props && e.props[E.mounted.id];
	}
}, O = Object.create(null), k = class e {
	constructor(e, t, n, r = 0) {
		this.name = e, this.props = t, this.id = n, this.flags = r;
	}
	static define(t) {
		let n = t.props && t.props.length ? Object.create(null) : O, r = +!!t.top | (t.skipped ? 2 : 0) | (t.error ? 4 : 0) | (t.name == null ? 8 : 0), i = new e(t.name || "", n, t.id, r);
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
			let t = this.prop(E.group);
			return t ? t.indexOf(e) > -1 : !1;
		}
		return this.id == e;
	}
	static match(e) {
		let t = Object.create(null);
		for (let n in e) for (let r of n.split(" ")) t[r] = e[n];
		return (e) => {
			for (let n = e.prop(E.group), r = -1; r < (n ? n.length : 0); r++) {
				let i = t[r < 0 ? e.name : n[r]];
				if (i) return i;
			}
		};
	}
};
k.none = new k("", Object.create(null), 0, 8);
var A = class e {
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
			n.push(r ? new k(e.name, r, e.id, e.flags) : e);
		}
		return new e(n);
	}
}, j = /* @__PURE__ */ new WeakMap(), ee = /* @__PURE__ */ new WeakMap(), M;
(function(e) {
	e[e.ExcludeBuffers = 1] = "ExcludeBuffers", e[e.IncludeAnonymous = 2] = "IncludeAnonymous", e[e.IgnoreMounts = 4] = "IgnoreMounts", e[e.IgnoreOverlays = 8] = "IgnoreOverlays", e[e.EnterBracketed = 16] = "EnterBracketed";
})(M ||= {});
var N = class e {
	constructor(e, t, n, r, i) {
		if (this.type = e, this.children = t, this.positions = n, this.length = r, this.props = null, i && i.length) {
			this.props = Object.create(null);
			for (let [e, t] of i) this.props[typeof e == "number" ? e : e.id] = t;
		}
	}
	toString() {
		let e = D.get(this);
		if (e && !e.overlay) return e.tree.toString();
		let t = "";
		for (let e of this.children) {
			let n = e.toString();
			n && (t && (t += ","), t += n);
		}
		return this.type.name ? (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (t.length ? "(" + t + ")" : "") : t;
	}
	cursor(e = 0) {
		return new B(this.topNode, e);
	}
	cursorAt(e, t = 0, n = 0) {
		let r = new B(j.get(this) || this.topNode);
		return r.moveTo(e, t), j.set(this, r._tree), r;
	}
	get topNode() {
		return new L(this, 0, 0, null);
	}
	resolve(e, t = 0) {
		let n = I(j.get(this) || this.topNode, e, t, !1);
		return j.set(this, n), n;
	}
	resolveInner(e, t = 0) {
		let n = I(ee.get(this) || this.topNode, e, t, !0);
		return ee.set(this, n), n;
	}
	resolveStack(e, t = 0) {
		return se(this, e, t);
	}
	iterate(e) {
		let { enter: t, leave: n, from: r = 0, to: i = this.length } = e, a = e.mode || 0, o = (a & M.IncludeAnonymous) > 0;
		for (let e = this.cursor(a | M.IncludeAnonymous);;) {
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
		return this.children.length <= 8 ? this : U(k.none, this.children, this.positions, 0, this.children.length, 0, this.length, (t, n, r) => new e(this.type, t, n, r, this.propValues), t.makeTree || ((t, n, r) => new e(k.none, t, n, r)));
	}
	static build(e) {
		return ce(e);
	}
};
N.empty = new N(k.none, [], [], 0);
var te = class e {
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
}, P = class e {
	constructor(e, t, n) {
		this.buffer = e, this.length = t, this.set = n;
	}
	get type() {
		return k.none;
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
		for (let s = e; s != t && !(F(i, r, a[s + 1], a[s + 2]) && (o = s, n > 0)); s = a[s + 3]);
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
function F(e, t, n, r) {
	switch (e) {
		case -2: return n < t;
		case -1: return r >= t && n < t;
		case 0: return n < t && r > t;
		case 1: return n <= t && r > t;
		case 2: return r > t;
		case 4: return !0;
	}
}
function I(e, t, n, r) {
	for (; e.from == e.to || (n < 1 ? e.from >= t : e.from > t) || (n > -1 ? e.to <= t : e.to < t);) {
		let t = !r && e instanceof L && e.index < 0 ? null : e.parent;
		if (!t) return e;
		e = t;
	}
	let i = r ? 0 : M.IgnoreOverlays;
	if (r) for (let r = e, a = r.parent; a; r = a, a = r.parent) r instanceof L && r.index < 0 && a.enter(t, n, i)?.from != r.from && (e = a);
	for (;;) {
		let r = e.enter(t, n, i);
		if (!r) return e;
		e = r;
	}
}
var ne = class {
	cursor(e = 0) {
		return new B(this, e);
	}
	getChild(e, t = null, n = null) {
		let r = re(this, e, t, n);
		return r.length ? r[0] : null;
	}
	getChildren(e, t = null, n = null) {
		return re(this, e, t, n);
	}
	resolve(e, t = 0) {
		return I(this, e, t, !1);
	}
	resolveInner(e, t = 0) {
		return I(this, e, t, !0);
	}
	matchContext(e) {
		return R(this.parent, e);
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
}, L = class e extends ne {
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
				if (a & M.EnterBracketed && l instanceof N && (d = D.get(l)) && !d.overlay && d.bracketed && r >= u && r <= u + l.length || F(i, r, u, u + l.length)) {
					if (l instanceof P) {
						if (a & M.ExcludeBuffers) continue;
						let e = l.findChild(0, l.buffer.length, n, r - u, i);
						if (e > -1) return new z(new ie(o, l, t, u), null, e);
					} else if (a & M.IncludeAnonymous || !l.type.isAnonymous || V(l)) {
						let s;
						if (!(a & M.IgnoreMounts) && (s = D.get(l)) && !s.overlay) return new e(s.tree, u, t, o);
						let c = new e(l, u, t, o);
						return a & M.IncludeAnonymous || !c.type.isAnonymous ? c : c.nextChild(n < 0 ? l.children.length - 1 : 0, n, r, i, a);
					}
				}
			}
			if (a & M.IncludeAnonymous || !o.type.isAnonymous || (t = o.index >= 0 ? o.index + n : n < 0 ? -1 : o._parent._tree.children.length, o = o._parent, !o)) return null;
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
		if (!(r & M.IgnoreOverlays) && (i = D.get(this._tree)) && i.overlay) {
			let a = t - this.from, o = r & M.EnterBracketed && i.bracketed;
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
function re(e, t, n, r) {
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
function R(e, t, n = t.length - 1) {
	for (let r = e; n >= 0; r = r.parent) {
		if (!r) return !1;
		if (!r.type.isAnonymous) {
			if (t[n] && t[n] != r.name) return !1;
			n--;
		}
	}
	return !0;
}
var ie = class {
	constructor(e, t, n, r) {
		this.parent = e, this.buffer = t, this.index = n, this.start = r;
	}
}, z = class e extends ne {
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
		if (r & M.ExcludeBuffers) return null;
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
		return new N(this.type, e, t, this.to - this.from);
	}
	toString() {
		return this.context.buffer.childString(this.index);
	}
};
function ae(e) {
	if (!e.length) return null;
	let t = 0, n = e[0];
	for (let r = 1; r < e.length; r++) {
		let i = e[r];
		(i.from > n.from || i.to < n.to) && (n = i, t = r);
	}
	let r = n instanceof L && n.index < 0 ? null : n.parent, i = e.slice();
	return r ? i[t] = r : i.splice(t, 1), new oe(i, n);
}
var oe = class {
	constructor(e, t) {
		this.heads = e, this.node = t;
	}
	get next() {
		return ae(this.heads);
	}
};
function se(e, t, n) {
	let r = e.resolveInner(t, n), i = null;
	for (let e = r instanceof L ? r : r.context.parent; e; e = e.parent) if (e.index < 0) {
		let a = e.parent;
		(i ||= [r]).push(a.resolve(t, n)), e = a;
	} else {
		let a = D.get(e.tree);
		if (a && a.overlay && a.overlay[0].from <= t && a.overlay[a.overlay.length - 1].to >= t) {
			let o = new L(a.tree, a.overlay[0].from + e.from, -1, e);
			(i ||= [r]).push(I(o, t, n, !1));
		}
	}
	return i ? ae(i) : r;
}
var B = class {
	get name() {
		return this.type.name;
	}
	constructor(e, t = 0) {
		if (this.buffer = null, this.stack = [], this.index = 0, this.bufferNode = null, this.mode = t & ~M.EnterBracketed, e instanceof L) this.yieldNode(e);
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
		return e ? e instanceof L ? (this.buffer = null, this.yieldNode(e)) : (this.buffer = e.context, this.yieldBuf(e.index, e.type)) : !1;
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
		return this.buffer ? n & M.ExcludeBuffers ? !1 : this.enterChild(1, e, t) : this.yield(this._tree.enter(e, t, n));
	}
	parent() {
		if (!this.buffer) return this.yieldNode(this.mode & M.IncludeAnonymous ? this._tree._parent : this._tree.parent);
		if (this.stack.length) return this.yieldBuf(this.stack.pop());
		let e = this.mode & M.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
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
			if (this.mode & M.IncludeAnonymous || e instanceof P || !e.type.isAnonymous || V(e)) return !1;
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
		for (let e = n; e < this.stack.length; e++) t = new z(this.buffer, t, this.stack[e]);
		return this.bufferNode = new z(this.buffer, t, this.index);
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
		if (!this.buffer) return R(this.node.parent, e);
		let { buffer: t } = this.buffer, { types: n } = t.set;
		for (let r = e.length - 1, i = this.stack.length - 1; r >= 0; i--) {
			if (i < 0) return R(this._tree, e, r);
			let a = n[t.buffer[this.stack[i]]];
			if (!a.isAnonymous) {
				if (e[r] && e[r] != a.name) return !1;
				r--;
			}
		}
		return !0;
	}
};
function V(e) {
	return e.children.some((e) => e instanceof P || !e.type.isAnonymous || V(e));
}
function ce(e) {
	let { buffer: t, nodeSet: n, maxBufferLength: r = C, reused: i = [], minRepeatType: a = n.types.length } = e, o = Array.isArray(t) ? new te(t, t.length) : t, s = n.types, c = 0, l = 0;
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
			O = new P(t, C - k.start, n), A = k.start - e;
		} else {
			let e = o.pos - w;
			o.next();
			let t = [], s = [], c = x >= a ? x : -1, h = 0, g = C, _ = T;
			for (; o.pos > e;) c >= 0 && o.id == c && o.size >= 0 ? (o.end <= g - r && (p(t, s, S, h, o.end, g, c, _, E), h = t.length, g = o.end, _ = l), o.next()) : b > 2500 ? d(S, e, t, s) : (c >= 0 && o.size == -1 && i[o.id].type == n.types[c] && (h < t.length && p(t, s, S, h, o.end, g, c, _, E), h = t.length + 1, g = o.start, _ = l), u(S, e, t, s, c, b + 1));
			if (c >= 0 && h > 0 && h < t.length && p(t, s, S, h, S, g, c, _, E), t.reverse(), s.reverse(), c > -1 && h > 0) {
				let e = f(D, E);
				O = U(D, t, s, 0, t.length, 0, C - S, e, e);
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
			i.push(new P(t, s[2] - r, n)), a.push(r - e);
		}
	}
	function f(e, t) {
		return (n, r, i) => {
			let a = 0, o = n.length - 1, s, c;
			if (o >= 0 && (s = n[o]) instanceof N) {
				if (!o && s.type == e && s.length == i) return s;
				(c = s.prop(E.lookAhead)) && (a = r[o] + s.length + c - i);
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
			let e = [E.contextHash, a];
			o = o ? [e].concat(o) : [e];
		}
		if (i > 25) {
			let e = [E.lookAhead, i];
			o = o ? [e].concat(o) : [e];
		}
		return new N(e, t, n, r, o);
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
	return new N(s[e.topID], _.reverse(), v.reverse(), y);
}
var le = /* @__PURE__ */ new WeakMap();
function H(e, t) {
	if (!e.isAnonymous || t instanceof P || t.type != e) return 1;
	let n = le.get(t);
	if (n == null) {
		n = 1;
		for (let r of t.children) {
			if (r.type != e || !(r instanceof N)) {
				n = 1;
				break;
			}
			n += H(e, r);
		}
		le.set(t, n);
	}
	return n;
}
function U(e, t, n, r, i, a, o, s, c) {
	let l = 0;
	for (let n = r; n < i; n++) l += H(e, t[n]);
	let u = Math.ceil(l * 1.5 / 8), d = [], f = [];
	function p(t, n, r, i, o) {
		for (let s = r; s < i;) {
			let r = s, l = n[s], m = H(e, t[s]);
			for (s++; s < i; s++) {
				let n = H(e, t[s]);
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
				d.push(U(e, t, n, r, s, l, i, null, c));
			}
			f.push(l + o - a);
		}
	}
	return p(t, n, r, i, 0), (s || c)(d, f, o);
}
var ue = class {
	startParse(e, t, n) {
		return typeof e == "string" && (e = new de(e)), n = n ? n.length ? n.map((e) => new T(e.from, e.to)) : [new T(0, 0)] : [new T(0, e.length)], this.createParse(e, t || [], n);
	}
	parse(e, t, n) {
		let r = this.startParse(e, t, n);
		for (;;) {
			let e = r.advance();
			if (e) return e;
		}
	}
}, de = class {
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
new E({ perNode: !0 });
// ../../node_modules/@lezer/lr/dist/index.js
var fe = class e {
	constructor(e, t, n, r, i, a, o, s, c, l = 0, u) {
		this.p = e, this.stack = t, this.state = n, this.reducePos = r, this.pos = i, this.score = a, this.buffer = o, this.bufferBase = s, this.curContext = c, this.lookAhead = l, this.parent = u;
	}
	toString() {
		return `[${this.stack.filter((e, t) => t % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
	}
	static start(t, n, r = 0) {
		let i = t.parser.context;
		return new e(t, [], n, r, r, 0, [], 0, i ? new pe(i, i.start) : null, 0, null);
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
		for (let t = new me(this);;) {
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
			let t = new pe(this.curContext.tracker, e);
			t.hash != this.curContext.hash && this.emitContext(), this.curContext = t;
		}
	}
	setLookAhead(e) {
		return e <= this.lookAhead ? !1 : (this.emitLookAhead(), this.lookAhead = e, !0);
	}
	close() {
		this.curContext && this.curContext.tracker.strict && this.emitContext(), this.lookAhead > 0 && this.emitLookAhead();
	}
}, pe = class {
	constructor(e, t) {
		this.tracker = e, this.context = t, this.hash = e.strict ? e.hash(t) : 0;
	}
}, me = class {
	constructor(e) {
		this.start = e, this.state = e.state, this.stack = e.stack, this.base = this.stack.length;
	}
	reduce(e) {
		let t = e & 65535, n = e >> 19;
		n == 0 ? (this.stack == this.start.stack && (this.stack = this.stack.slice()), this.stack.push(this.state, 0, 0), this.base += 3) : this.base -= (n - 1) * 3;
		let r = this.start.p.parser.getGoto(this.stack[this.base - 3], t, !0);
		this.state = r;
	}
}, he = class e {
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
function W(e, t = Uint16Array) {
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
var G = class {
	constructor() {
		this.start = -1, this.value = -1, this.end = -1, this.extended = -1, this.lookAhead = 0, this.mask = 0, this.context = 0;
	}
}, ge = new G(), _e = class {
	constructor(e, t) {
		this.input = e, this.ranges = t, this.chunk = "", this.chunkOff = 0, this.chunk2 = "", this.chunk2Pos = 0, this.next = -1, this.token = ge, this.rangeIndex = 0, this.pos = this.chunkPos = t[0].from, this.range = t[0], this.end = t[t.length - 1].to, this.readNext();
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
		if (t ? (this.token = t, t.start = e, t.lookAhead = e + 1, t.value = t.extended = -1) : this.token = ge, this.pos != e) {
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
}, K = class {
	constructor(e, t) {
		this.data = e, this.id = t;
	}
	token(e, t) {
		let { parser: n } = t.p;
		ye(this.data, e, t, this.id, n.data, n.tokenPrecTable);
	}
};
K.prototype.contextual = K.prototype.fallback = K.prototype.extend = !1;
var ve = class {
	constructor(e, t, n) {
		this.precTable = t, this.elseToken = n, this.data = typeof e == "string" ? W(e) : e;
	}
	token(e, t) {
		let n = e.pos, r = 0;
		for (;;) {
			let n = e.next < 0, i = e.resolveOffset(1, 1);
			if (ye(this.data, e, t, 0, this.data, this.precTable), e.token.value > -1) break;
			if (this.elseToken == null) return;
			if (n || r++, i == null) break;
			e.reset(i, e.token);
		}
		r && (e.reset(n, e.token), e.acceptToken(this.elseToken, r));
	}
};
ve.prototype.contextual = K.prototype.fallback = K.prototype.extend = !1;
function ye(e, t, n, r, i, a) {
	let o = 0, s = 1 << r, { dialect: c } = n.p.parser;
	scan: for (; (s & e[o]) != 0;) {
		let n = e[o + 1];
		for (let r = o + 3; r < n; r += 2) if ((e[r + 1] & s) > 0) {
			let n = e[r];
			if (c.allows(n) && (t.token.value == -1 || t.token.value == n || xe(n, t.token.value, i, a))) {
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
function be(e, t, n) {
	for (let r = t, i; (i = e[r]) != 65535; r++) if (i == n) return r - t;
	return -1;
}
function xe(e, t, n, r) {
	let i = be(n, r, t);
	return i < 0 || be(n, r, e) < i;
}
var q = typeof process < "u" && process.env && /\bparse\b/.test(process.env.LOG), Se = null;
function Ce(e, t, n) {
	let r = e.cursor(M.IncludeAnonymous);
	for (r.moveTo(t);;) if (!(n < 0 ? r.childBefore(t) : r.childAfter(t))) for (;;) {
		if ((n < 0 ? r.to < t : r.from > t) && !r.type.isError) return n < 0 ? Math.max(0, Math.min(r.to - 1, t - 25)) : Math.min(e.length, Math.max(r.from + 1, t + 25));
		if (n < 0 ? r.prevSibling() : r.nextSibling()) break;
		if (!r.parent()) return n < 0 ? 0 : e.length;
	}
}
var we = class {
	constructor(e, t) {
		this.fragments = e, this.minRepeat = t, this.i = 0, this.fragment = null, this.safeFrom = -1, this.safeTo = -1, this.trees = [], this.start = [], this.index = [], this.lastRepeat = null, this.lastRepeatPos = -1, this.nextFragment();
	}
	nextFragment() {
		let e = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
		if (e) {
			for (this.safeFrom = e.openStart ? Ce(e.tree, e.from + e.offset, 1) - e.offset : e.from, this.safeTo = e.openEnd ? Ce(e.tree, e.to + e.offset, -1) - e.offset : e.to; this.trees.length;) this.trees.pop(), this.start.pop(), this.index.pop();
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
			if (i instanceof N) {
				let n = a > this.lastRepeatPos && i.type.id >= this.minRepeat;
				if (a == e || n) {
					let t = a + i.length, r;
					if (a >= this.safeFrom && t <= this.safeTo && (!(r = i.prop(E.lookAhead)) || t + r < this.fragment.to) && (n && (this.lastRepeat = i, this.lastRepeatPos = a), a == e)) return i;
				}
				this.index[t]++, a + i.length >= Math.max(this.safeFrom, e) && (this.trees.push(i), this.start.push(a), this.index.push(0));
			} else this.index[t]++, this.nextStart = a + i.length;
		}
	}
}, Te = class {
	constructor(e, t) {
		this.stream = t, this.tokens = [], this.mainToken = null, this.actions = [], this.tokens = e.tokenizers.map((e) => new G());
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
		return s && e.setLookAhead(s), !n && e.pos == this.stream.end && (n = new G(), n.value = e.p.parser.eofTerm, n.start = n.end = e.pos, t = this.addActions(e, n.value, n.end, t)), this.mainToken = n, this.actions;
	}
	getMainToken(e) {
		if (this.mainToken) return this.mainToken;
		let t = new G(), { pos: n, p: r } = e;
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
				if (o[s + 1] == 1) s = J(o, s + 2);
				else {
					r == 0 && o[s + 1] == 2 && (r = this.putAction(J(o, s + 2), t, n, r));
					break;
				}
			}
			o[s] == t && (r = this.putAction(J(o, s + 1), t, n, r));
		}
		return r;
	}
}, Ee = class {
	constructor(e, t, n, r) {
		this.parser = e, this.input = t, this.ranges = r, this.recovering = 0, this.nextStackID = 9812, this.minStackPos = 0, this.reused = [], this.stoppedAt = null, this.lastBigReductionStart = -1, this.lastBigReductionSize = 0, this.bigReductionCount = 0, this.stream = new _e(t, r), this.tokens = new Te(e, this.stream), this.topTerm = e.top[1];
		let { from: i } = r[0];
		this.stacks = [fe.start(this, e.top[0], i)], this.fragments = n.length && this.stream.end - i > e.bufferLength * 4 ? new we(n, e.minRepeatTerm) : null;
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
			let e = r && Ae(r);
			if (e) return q && console.log("Finish with " + this.stackID(e)), this.stackToTree(e);
			if (this.parser.strict) throw q && r && console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none")), SyntaxError("No parse at " + t);
			this.recovering ||= 5;
		}
		if (this.recovering && r) {
			let e = this.stoppedAt != null && r[0].pos > this.stoppedAt ? r[0] : this.runRecovery(r, i, n);
			if (e) return q && console.log("Force-finish " + this.stackID(e)), this.stackToTree(e.forceAll());
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
			if (o > -1 && n.length && (!i || (n.prop(E.contextHash) || 0) == a)) return e.useNode(n, o, t), n;
			if (n.children.length == 0 || n.positions[0] > 0) break;
			let s = n.children[0];
			if (s instanceof N && (!r || s.type.id >= this.parser.minRepeatTerm)) n = s;
			else break;
		}
		return null;
	}
	advanceStack(e, t, n) {
		let r = e.pos, { parser: i } = this, a = q ? this.stackID(e) + " -> " : "";
		if (this.stoppedAt != null && r > this.stoppedAt) return e.forceReduce() ? e : null;
		if (this.fragments) {
			let t = e.reducePos < r && e.buffer.length && e.buffer[e.buffer.length - 2] <= e.reducePos && this.fragments.lastRepeatPos == e.reducePos && this.tryReuse(e, e.reducePos, this.fragments.lastRepeat, !0) || this.tryReuse(e, r, this.fragments.nodeAt(r), !1);
			if (t) return q && console.log(a + this.stackID(e) + ` (via reuse of ${i.getName(t.type.id)})`), !0;
		}
		let o = i.stateSlot(e.state, 4);
		if (o > 0) return e.reduce(o), q && console.log(a + this.stackID(e) + ` (via always-reduce ${i.getName(o & 65535)})`), !0;
		if (e.stack.length >= 8400) for (; e.stack.length > 6e3 && e.forceReduce(););
		let s = this.tokens.getActions(e);
		for (let o = 0; o < s.length;) {
			let c = s[o++], l = s[o++], u = s[o++], d = o == s.length || !n, f = d ? e : e.split(), p = this.tokens.mainToken;
			if (f.apply(c, l, p ? p.start : f.pos, u), q && console.log(a + this.stackID(f) + ` (via ${c & 65536 ? `reduce of ${i.getName(c & 65535)}` : "shift"} for ${i.getName(l)} @ ${r}${f == e ? "" : ", split"})`), d) return !0;
			f.pos > r ? t.push(f) : n.push(f);
		}
		return !1;
	}
	advanceFully(e, t) {
		let n = e.pos;
		for (;;) {
			if (!this.advanceStack(e, null, null)) return !1;
			if (e.pos > n) return De(e, t), !0;
		}
	}
	runRecovery(e, t, n) {
		let r = null, i = !1;
		for (let a = 0; a < e.length; a++) {
			let o = e[a], s = t[a << 1], c = t[(a << 1) + 1], l = q ? this.stackID(o) + " -> " : "";
			if (o.deadEnd && (i || (i = !0, o.restart(), q && console.log(l + this.stackID(o) + " (restarted)"), this.advanceFully(o, n)))) continue;
			let u = o.split(), d = l;
			for (let e = 0; e < 10 && u.forceReduce() && (q && console.log(d + this.stackID(u) + " (via force-reduce)"), !this.advanceFully(u, n)); e++) q && (d = this.stackID(u) + " -> ");
			for (let e of o.recoverByInsert(s)) q && console.log(l + this.stackID(e) + " (via recover-insert)"), this.advanceFully(e, n);
			this.stream.end > o.pos ? (c == o.pos && (c++, s = 0), o.recoverByDelete(s, c), q && console.log(l + this.stackID(o) + ` (via recover-delete ${this.parser.getName(s)})`), De(o, n)) : (!r || r.score < u.score) && (r = u);
		}
		return r;
	}
	stackToTree(e) {
		return e.close(), N.build({
			buffer: he.create(e),
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
		let t = (Se ||= /* @__PURE__ */ new WeakMap()).get(e);
		return t || Se.set(e, t = String.fromCodePoint(this.nextStackID++)), t + e;
	}
};
function De(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (r.pos == e.pos && r.sameState(e)) {
			t[n].score < e.score && (t[n] = e);
			return;
		}
	}
	t.push(e);
}
var Oe = class {
	constructor(e, t, n) {
		this.source = e, this.flags = t, this.disabled = n;
	}
	allows(e) {
		return !this.disabled || this.disabled[e] == 0;
	}
}, ke = class e extends ue {
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
			typeof e == "string" && (e = E[e]);
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
		this.nodeSet = new A(t.map((t, i) => k.define({
			name: i >= this.minRepeatTerm ? void 0 : t,
			id: i,
			props: r[i],
			top: n.indexOf(i) > -1,
			error: i == 0,
			skipped: e.skippedNodes && e.skippedNodes.indexOf(i) > -1
		}))), e.propSources && (this.nodeSet = this.nodeSet.extend(...e.propSources)), this.strict = !1, this.bufferLength = C;
		let a = W(e.tokenData);
		this.context = e.context, this.specializerSpecs = e.specialized || [], this.specialized = new Uint16Array(this.specializerSpecs.length);
		for (let e = 0; e < this.specializerSpecs.length; e++) this.specialized[e] = this.specializerSpecs[e].term;
		this.specializers = this.specializerSpecs.map(je), this.states = W(e.states, Uint32Array), this.data = W(e.stateData), this.goto = W(e.goto), this.maxTerm = e.maxTerm, this.tokenizers = e.tokenizers.map((e) => typeof e == "number" ? new K(a, e) : e), this.topRules = e.topRules, this.dialects = e.dialects || {}, this.dynamicPrecedences = e.dynamicPrecedences || null, this.tokenPrecTable = e.tokenPrec, this.termNames = e.termNames || null, this.maxNode = this.nodeSet.types.length - 1, this.dialect = this.parseDialect(), this.top = this.topRules[Object.keys(this.topRules)[0]];
	}
	createParse(e, t, n) {
		let r = new Ee(this, e, t, n);
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
				if (n[i + 1] == 1) a = n[i = J(n, i + 2)];
				else if (n[i + 1] == 2) return J(n, i + 2);
				else break;
			}
			if (a == t || a == 0) return J(n, i + 1);
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
				if (this.data[n + 1] == 1) n = J(this.data, n + 2);
				else break;
			}
			r = t(J(this.data, n + 1));
		}
		return r;
	}
	nextStates(e) {
		let t = [];
		for (let n = this.stateSlot(e, 1);; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = J(this.data, n + 2);
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
			return n.specializers[r] = je(a), a;
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
		return new Oe(e, n, r);
	}
	static deserialize(t) {
		return new e(t);
	}
};
function J(e, t) {
	return e[t] | e[t + 1] << 16;
}
function Ae(e) {
	let t = null;
	for (let n of e) {
		let e = n.p.stoppedAt;
		(n.pos == n.p.stream.end || e != null && n.pos > e) && n.p.parser.stateFlag(n.state, 2) && (!t || t.score < n.score) && (t = n);
	}
	return t;
}
function je(e) {
	if (e.external) {
		let t = +!!e.extend;
		return (n, r) => e.external(n, r) << 1 | t;
	}
	return e.get;
}
// src/dsl/grammar/dav.grammar
var Me = {
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
}, Ne = ke.deserialize({
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
		get: (e) => Me[e] || -1
	}],
	tokenPrec: 0
}), Pe = /* @__PURE__ */ new Set([
	"String",
	"Number",
	"Color",
	"Identifier",
	"Boolean"
]);
function Fe(e) {
	return Ne.parse(e);
}
function Y(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) t.push(n);
	return t;
}
function Ie(e) {
	for (let t = e.firstChild; t; t = t.nextSibling) if (Pe.has(t.name)) return t;
	return null;
}
function X(e, t) {
	return e.slice(t.from, t.to);
}
function Le(e) {
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
function Re(e) {
	let t = e.startsWith("```"), n = e.length >= (t ? 6 : 3) && e.endsWith("```");
	return a(e.slice(t ? 3 : 0, n ? -3 : void 0));
}
// src/dsl/attributes.ts
var ze = {
	string: "\"...\"",
	bool: "true | false",
	color: c.join(" | "),
	stateColor: [...c, u].join(" | "),
	icon: o.join(" | "),
	border: f.join(" | "),
	mount: m.join(" | ")
};
function Be(e, t, n) {
	let { value: r, invalid: i } = Le(X(e, t));
	for (let e of i) {
		let r = t.from + e.offset;
		n("invalid-escape", "error", {
			from: r,
			to: r + e.sequence.length
		}, { sequence: e.sequence });
	}
	return r;
}
function Ve(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	if (t) {
		let a = _[n], o = /* @__PURE__ */ new Set();
		for (let s of t.getChildren("Attribute")) {
			let t = s.getChild("AttrName"), c = Ie(s);
			if (!t || !c) continue;
			let l = X(e, t), u = Object.hasOwn(a, l) ? a[l] : void 0;
			if (!u) {
				r("unknown-attribute", "warning", t, {
					name: l,
					owner: n
				});
				continue;
			}
			o.has(l) && r("duplicate-attribute", "warning", t, { name: l }), o.add(l);
			let d = He(e, l, u, c, r);
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
function He(e, t, n, r, i) {
	let a = X(e, r), o = () => {
		i("invalid-attribute-value", "error", r, {
			name: t,
			expected: ze[n]
		});
	};
	switch (n) {
		case "string": return r.name === "String" ? Be(e, r, i) : o();
		case "bool": return r.name === "Boolean" ? a === "true" : o();
		case "color":
		case "stateColor": return r.name !== "Identifier" && r.name !== "Color" ? o() : Ue(a, r, n === "stateColor", i);
		case "icon": return r.name === "Identifier" ? We(a, r, i) : o();
		case "border": {
			if (r.name !== "Identifier") return o();
			let e = a.toLowerCase();
			return p(e) ? e : o();
		}
		case "mount": {
			if (r.name !== "Identifier") return o();
			let e = a.toLowerCase();
			return h(e) ? e : o();
		}
	}
}
function Ue(e, t, n, r) {
	let i = e.toLowerCase();
	if (l(i)) return i;
	if (n && i === "none") return u;
	r("invalid-color", "error", t, {
		value: e,
		suggestion: (t.name === "Color" ? void 0 : x(e, c)) ?? "",
		names: (n ? [...c, u] : c).join(", ")
	});
}
function We(e, t, n) {
	let r = e.toLowerCase();
	if (s(r)) return r;
	n("unknown-icon", "error", t, {
		icon: e,
		suggestion: x(e, o) ?? ""
	});
}
// src/dsl/sourceMap.ts
function Z(e) {
	return {
		from: e.from,
		to: e.to
	};
}
// src/dsl/analyze.ts
var Ge = {
	style: "solid",
	direction: "forward"
}, Ke = /^\s*dav\s+\d+(?:\.\d+)?\s*(?:\/\/.*)?$/, qe = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*(?:-->|\.\.>|<->|<\.>)\s*[A-Za-z_][A-Za-z0-9_]*/;
function Je(e, t) {
	let n = [], r = 0;
	for (let i of e.split("\n")) {
		let e = r + i.length, a = i.replace(/\r$/, ""), o = Ke.test(a), s = o ? null : qe.exec(a), c = t.some((t) => t.code === "syntax-error" && t.from >= r && t.from <= e);
		if ((o || s) && c) {
			let t = /^\S+/.exec(a.trimStart())?.[0] ?? "", i = s?.[0]?.trim().replace(/\s+/g, " ") ?? "";
			n.push({
				start: r,
				end: e,
				error: {
					code: "syntax-error",
					severity: "error",
					from: r + (a.length - a.trimStart().length),
					to: r + a.trimEnd().length,
					args: o ? {
						token: t,
						hint: "v1-header"
					} : {
						token: t,
						hint: "v1-edge",
						title: i
					}
				}
			});
		}
		r = e + 1;
	}
	return n;
}
function Ye(e) {
	let t = new Xe(e).run(), n = e, r = [];
	for (let e = 0; e < 3; e++) {
		let e = Je(n, t.diagnostics);
		if (e.length === 0) break;
		for (let { start: t, end: i, error: a } of e) n = n.slice(0, t) + n.slice(t, i).replace(/[^\r]/g, " ") + n.slice(i), r.push(a);
		t = new Xe(n).run();
	}
	return r.length === 0 || (t.diagnostics.push(...r), t.diagnostics.sort((e, t) => e.from - t.from || e.to - t.to)), t;
}
var Xe = class {
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
		let e = Fe(this.text).topNode;
		this.collectSyntaxErrors(e);
		for (let t of Y(e)) switch (t.name) {
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
			if (t.add(n.from), n.from >= i(this.text).length) {
				if (t.size > 1) continue;
				let e = this.text.length;
				this.report("unexpected-eof", "error", {
					from: e,
					to: e
				});
				continue;
			}
			let e = n.to > n.from ? X(this.text, n) : /^\S+/.exec(this.text.slice(n.from))?.[0] ?? "", r = (e) => (e.length > 24 ? `${e.slice(0, 24)}…` : e).split("\n")[0] ?? "", a = n.node.prevSibling, o = n.node.parent?.name === "Code" && !n.node.parent.getChild("CodeFence") && a?.name === "String" && e.startsWith("\"") && !this.text.slice(a.to, n.from).includes("\n") ? X(this.text, a) : void 0;
			this.report("syntax-error", "error", {
				from: n.from,
				to: Math.max(n.to, n.from + e.length)
			}, o === void 0 ? { token: r(e) } : {
				token: r(e),
				hint: "code-title",
				title: `"${r(o.slice(1, -1))}"`
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
		let r = X(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "group"), a = {
			id: r,
			label: this.readChildString(e, "Label") ?? r
		};
		t && (a.parentId = t);
		let o = i.value("icon");
		o !== void 0 && (a.icon = o);
		let s = i.value("color");
		s !== void 0 && (a.color = s);
		let c = i.value("border");
		c !== void 0 && (a.border = c);
		let l = this.declare({
			kind: "group",
			id: r,
			from: e.from,
			to: e.to,
			idRange: Z(n)
		});
		l && this.doc.groups.push(a);
		let u = e.getChild("GroupBody");
		if (!u) return;
		let d = l ? r : t;
		for (let e of Y(u)) e.name === "Group" ? this.readGroup(e, d) : e.name === "Node" && this.readNode(e, d);
	}
	readNode(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = X(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "node"), a = {
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
			idRange: Z(n)
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
		for (let e of n ? Y(n) : []) switch (e.name) {
			case "Focus":
				for (let n of e.getChildren("Identifier")) {
					let e = X(this.text, n);
					t.focus.push(e), this.references.push({
						id: e,
						range: Z(n),
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
		let r = X(this.text, n), i = e.getChild("Attributes"), a = this.readAttributes(i, "state");
		i && i.getChildren("Attribute").length === 0 && this.report("empty-state", "warning", e);
		let o = { target: r }, s = a.value("visible");
		s !== void 0 && (o.visible = s);
		let c = a.value("badge");
		c !== void 0 && (o.badge = c);
		let l = a.value("color");
		l !== void 0 && (o.color = l), t.states.push(o), this.references.push({
			id: r,
			range: Z(n),
			allowed: ["node", "group"]
		}), this.stateChecks.push({
			target: r,
			attrs: a.entries
		});
	}
	readConnection(e, t) {
		let [n, r] = e.getChildren("Identifier"), i = e.getChild("Arrow");
		if (!n || !r || !i) return;
		let a = X(this.text, n), o = X(this.text, r), s = X(this.text, i), c = b[s] ?? Ge;
		a === o && c.direction === "bidirectional" && this.report("invalid-self-arrow", "error", i, {
			arrow: s,
			suggestion: c.style === "dashed" ? "..>" : "-->"
		});
		let l = t === "static" ? ["node", "group"] : ["node"];
		this.references.push({
			id: a,
			range: Z(n),
			allowed: l
		}, {
			id: o,
			range: Z(r),
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
		let { attrs: i } = n, a = {
			from: n.from,
			to: n.to,
			style: n.style,
			direction: n.direction,
			parallel: i.value("parallel") ?? !1
		};
		n.label !== void 0 && (a.label = n.label);
		let o = i.value("color");
		o !== void 0 && (a.color = o);
		let s = i.value("icon");
		s !== void 0 && (a.icon = s);
		let c = [], l = i.value("desc");
		l !== void 0 && l.length > 0 && c.push(l);
		let u = e.getChild("AnimateBody");
		c.push(...this.readDescList(u)), c.length > 0 && (a.description = c.join("\n"));
		let d = !1, f, p = i.get("code");
		if (p !== void 0 && (d = !0, r(p.value) || (f = { body: p.value })), u) for (let e of Y(u)) {
			if (e.name !== "Code") continue;
			d && this.report("duplicate-code", "warning", e), d = !0;
			let t = this.readCode(e);
			t !== void 0 && (f = t);
		}
		f !== void 0 && (a.code = f), t.animations.push(a);
	}
	readCode(e) {
		let t = e.getChild("CodeLang"), n = e.getChild("String"), i = e.getChild("CodeFence"), a, o;
		if (i ? (n && (a = this.readString(n)), o = Re(X(this.text, i))) : n && (o = this.readString(n)), o === void 0 || r(o)) return;
		let s = { body: o };
		return t && (s.lang = X(this.text, t)), a !== void 0 && (s.title = a), s;
	}
	readString(e) {
		return Be(this.text, e, this.reportFn);
	}
	readChildString(e, t) {
		let n = (t ? e.getChild(t) : e)?.getChild("String");
		return n ? this.readString(n) : void 0;
	}
	readDescList(e) {
		if (!e) return [];
		let t = [];
		for (let n of Y(e)) if (n.name === "Desc") {
			let e = this.readChildString(n);
			e !== void 0 && t.push(e);
		}
		return t;
	}
	readAttributes(e, t) {
		return Ve(this.text, e, t, this.reportFn);
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
			let n = v[t.kind];
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
}, Ze = y.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
RegExp(`(?:${Ze})\\s*\\w*$`), RegExp(`${Ze}|^\\s*(?:animate|static)\\b`);
// src/dsl/diagnostics.ts
var Qe = {
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
}, $e = {
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
}, et = {
	ja: "（もしかして \"{value}\"？）",
	en: " (did you mean \"{value}\"?)"
};
Object.keys(Qe.en);
var tt = {
	ja: {
		"code-title": "。1行形式の code にはタイトルを付けられません。{title} がタイトルなら消すか、タイトルを残すならコードを ``` の行で囲んでください",
		"v1-header": "。.dav v2 にヘッダはありません。この行を消してください",
		"v1-edge": "。v2 では接続を step の中に書きます。パケットが通るなら animate {title}、通らないなら static {title}"
	},
	en: {
		"code-title": ". A one-line code takes no title: if {title} is one, remove it, or put the code between lines of ``` to keep it",
		"v1-header": ". A .dav v2 file has no header: remove this line",
		"v1-edge": ". In v2 a connection is written inside a step: animate {title} when a packet travels it, static {title} when none does"
	}
}, nt = /* @__PURE__ */ new Set([
	"owner",
	"kind",
	"actual",
	"expected"
]);
function rt(e, t = "en") {
	return Qe[t][e.code].replace(/\{(\w+)\}/g, (n, r) => {
		let i = e.args[r] ?? "";
		return r === "suggestion" ? i ? et[t].replace("{value}", i) : "" : r === "hint" ? (tt[t][i] ?? "").replaceAll("{title}", () => e.args.title ?? "") : nt.has(r) ? i.split(/\s*\|\s*/).map((e) => $e[t][e] ?? e).join(t === "ja" ? "・" : " or ") : i;
	});
}
// src/model/zones.ts
var it = (e, t) => `${e}\u0000${t}`;
// src/model/connections.ts
function at(e, t) {
	return e <= t ? it(e, t) : it(t, e);
}
function ot(e, t, n, r, i, a, o, s) {
	let c = at(t, n), l = e.get(c);
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
function st(e, t = g(e.from, e.to)) {
	return {
		id: t,
		from: e.from,
		to: e.to,
		style: e.seenSolid ? "solid" : "dashed",
		direction: e.from !== e.to && e.seenForward && e.seenBackward ? "bidirectional" : "forward",
		animated: e.animated
	};
}
function ct(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.steps) {
		for (let e of n.animations) ot(t, e.from, e.to, e.style, e.direction, "animate");
		for (let e of n.statics) ot(t, e.from, e.to, e.style, e.direction, "static", e.label, e.color);
	}
	return [...t.values()].map((e) => st(e));
}
// src/skill/lines.ts
var lt = (e) => e.replace(/\p{Cc}+/gu, (e) => /^\t+$/.test(e) ? e : " "), ut = "Usage: node dav-outline.mjs [--json] <file.dav>", Q = 0, dt = 1, ft = 2, $ = (e) => e.direction === "bidirectional" ? e.style === "dashed" ? "<.>" : "<->" : e.style === "dashed" ? "..>" : "-->";
function pt(e, t) {
	let n = e.steps.find((e) => e.states.some((e) => e.target === t && e.visible) || e.animations.some((e) => e.from === t || e.to === t) || e.statics.some((e) => e.from === t || e.to === t));
	return n ? n.index + 1 : 0;
}
function mt(e) {
	let t = [];
	for (let n of e.animations) {
		let e = t[t.length - 1];
		n.parallel && e ? e.push(n) : t.push([n]);
	}
	return t.flatMap((e, t) => e.map((n, r) => {
		let i = {
			number: `${t + 1}${e.length > 1 ? String.fromCharCode(97 + r) : ""}`,
			from: n.from,
			to: n.to,
			arrow: $(n),
			roundTrip: n.direction === "bidirectional"
		};
		return n.label && (i.label = n.label), n.description && (i.desc = n.description), n.icon && (i.icon = n.icon), n.color && (i.color = n.color), n.code?.body.trim() && (i.code = { body: n.code.body.trim() }, n.code.lang && (i.code.lang = n.code.lang), n.code.title && (i.code.title = n.code.title)), i;
	}));
}
function ht(e) {
	let t = ct(e), n = (t) => {
		let n = {
			id: t.id,
			label: t.label,
			icon: t.icon
		};
		return t.sub && (n.sub = t.sub), t.badge && (n.badge = t.badge), t.color && (n.color = t.color), t.visible || (n.shownFromStep = pt(e, t.id)), n;
	}, r = (t) => {
		let i = e.groups.find((e) => e.id === t), a = {
			id: t,
			label: i?.label ?? t,
			zones: e.groups.filter((e) => e.parentId === t).map((e) => r(e.id)),
			nodes: e.nodes.filter((e) => e.parentId === t).map(n)
		};
		return i?.icon && (a.icon = i.icon), i?.color && (a.color = i.color), a;
	}, i = t.map((e) => ({
		from: e.from,
		to: e.to,
		arrow: $(e),
		animated: e.animated
	})), a = t.filter((e) => e.from !== e.to), o = (e) => a.some((t) => t.to === e), s = (e) => a.some((t) => t.from === e), c = e.steps.map((e) => {
		let t = e.index + 1, n = e.states.map((e) => {
			let t = [];
			return e.visible !== void 0 && t.push(e.visible ? "shown" : "hidden"), e.badge !== void 0 && t.push(e.badge ? `badge "${e.badge}"` : "badge removed"), e.color !== void 0 && t.push(e.color === "none" ? "color back to its own" : `color ${e.color}`), `${e.target}: ${t.join(", ")}`;
		}), r = e.statics.map((e) => {
			let t = {
				from: e.from,
				to: e.to,
				arrow: $(e)
			};
			return e.label && (t.label = e.label), e.color && (t.color = e.color), t;
		}), i = {
			number: t,
			title: e.title,
			focus: e.focus,
			changes: n,
			statics: r,
			phases: mt(e)
		};
		return e.description.trim() && (i.desc = e.description.trim()), i;
	}), l = new Set(e.steps.flatMap((e) => [
		...e.focus,
		...e.states.map((e) => e.target),
		...e.animations.flatMap((e) => [e.from, e.to]),
		...e.statics.flatMap((e) => [e.from, e.to])
	]));
	return {
		title: e.title,
		counts: {
			nodes: e.nodes.length,
			zones: e.groups.length,
			edges: t.length,
			steps: e.steps.length
		},
		zones: e.groups.filter((e) => e.parentId === void 0).map((e) => r(e.id)),
		nodes: e.nodes.filter((e) => e.parentId === void 0).map(n),
		edges: i,
		entryPoints: e.nodes.filter((e) => s(e.id) && !o(e.id)).map((e) => e.id),
		endPoints: e.nodes.filter((e) => o(e.id) && !s(e.id)).map((e) => e.id),
		unconnected: e.nodes.filter((e) => !o(e.id) && !s(e.id)).map((e) => e.id),
		steps: c,
		neverInAStep: e.steps.length > 0 ? e.nodes.filter((e) => !l.has(e.id)).map((e) => e.id) : [],
		edgesWithoutPackets: e.steps.length > 0 ? t.filter((e) => !e.animated).map((e) => `${e.from} ${$(e)} ${e.to}`) : []
	};
}
function gt(e, t, n) {
	let r = new Map(t.nodes.map((e) => [e.id, e.label])), i = (e) => r.has(e) ? `${r.get(e)} (${e})` : e, a = (e) => e.from === e.to ? `${i(e.from)} ↻ (on itself)` : `${i(e.from)} ${e.roundTrip ? "⇄" : "→"} ${i(e.to)}`, o = [], { counts: s } = n;
	o.push(`# ${n.title || "(no title)"}`), o.push(""), o.push(`${e}: ${s.nodes} nodes, ${s.zones} zones, ${s.edges} edges, ${s.steps} steps`);
	let c = (e) => e === void 0 ? "" : e === 0 ? "; hidden, and no step shows it" : `; hidden until step ${e}`, l = (e, t) => `${t}- ${e.label} (${e.id}): ${e.icon}${e.sub ? `; ${e.sub}` : ""}${e.badge ? `; badge "${e.badge}"` : ""}${e.color ? `; ${e.color}` : ""}${c(e.shownFromStep)}`, u = (e, t) => {
		o.push(`${t}- Zone "${e.label}" (${e.id})${e.color ? ` [${e.color}]` : ""}`);
		for (let n of e.zones) u(n, `${t}  `);
		for (let n of e.nodes) o.push(l(n, `${t}  `));
	};
	o.push("", "## Zones and nodes", "");
	for (let e of n.zones) u(e, "");
	if (n.nodes.length > 0) {
		n.zones.length > 0 && o.push("- Outside every zone");
		for (let e of n.nodes) o.push(l(e, n.zones.length > 0 ? "  " : ""));
	}
	o.push("", "## Connections", ""), o.push("`-->` one way, `<->` both ways, `..>` and `<.>` the same drawn dashed.", "");
	for (let e of n.edges) o.push(`- ${i(e.from)} ${e.arrow} ${i(e.to)}${e.animated ? "" : " [static only]"}`);
	let d = (e, t, n = i) => {
		t.length > 0 && o.push(`${e}: ${t.map(n).join(", ")}`);
	};
	if (o.push(""), d("Entry points (nothing points at them)", n.entryPoints), d("End points (they point at nothing)", n.endPoints), d("Not connected to anything", n.unconnected), n.steps.length > 0) {
		o.push("", "## Steps", ""), o.push("Packets are listed in the order they travel. Packets with the same number and a letter (2a, 2b) travel at the same time.");
		for (let e of n.steps) {
			o.push("", `### Step ${e.number}: ${e.title}`, ""), e.desc && o.push(e.desc.replace(/\n/g, " "), ""), e.focus.length > 0 && o.push(`Focus: ${e.focus.map(i).join(", ")}`);
			for (let t of e.changes) o.push(`State in this step: ${t}`);
			for (let t of e.statics) {
				let e = t.color ? ` [${t.color}]` : "";
				o.push(`Static link: ${i(t.from)} ${t.arrow} ${i(t.to)}${t.label ? ` : "${t.label}"` : ""}${e}`);
			}
			e.focus.length + e.changes.length + e.statics.length > 0 && o.push("");
			for (let t of e.phases) {
				let e = t.arrow === "..>" || t.arrow === "<.>" ? "dashed" : "", n = [
					t.icon ? `carries ${t.icon}` : "",
					t.color ?? "",
					e
				].filter(Boolean).join("; ");
				if (o.push(`${t.number}. ${a(t)}${t.label ? ` : "${t.label}"` : ""}${t.roundTrip ? " (there and back)" : ""}${n ? ` [${n}]` : ""}`), t.desc && o.push(`   ${t.desc.replace(/\n/g, " ")}`), t.code) {
					let e = [t.code.lang, t.code.title].filter(Boolean).join(" · ");
					o.push(`   code${e ? ` (${e})` : ""}:`);
					for (let e of t.code.body.split("\n")) o.push(`     ${e}`);
				}
			}
			e.phases.length === 0 && o.push("No packet travels in this step.");
		}
	}
	return (n.neverInAStep.length > 0 || n.edgesWithoutPackets.length > 0) && (o.push("", "## Not part of any step", ""), d("Nodes no step touches", n.neverInAStep), d("Edges no packet rides", n.edgesWithoutPackets, (e) => e)), `${o.map(lt).join("\n")}\n`;
}
function _t(t, n = ut) {
	if (t.includes("--help") || t.includes("-h")) return console.log(n), Q;
	let r = t.filter((e) => e !== "--json"), [i] = r;
	if (r.length !== 1 || !i || i.startsWith("-")) return console.error(n), ft;
	let a;
	try {
		a = e(i, "utf8").replace(/^﻿/, "");
	} catch (e) {
		return console.error(`${i}: ${e instanceof Error ? e.message : String(e)}`), ft;
	}
	let { document: o, diagnostics: s } = Ye(a), c = ht(o);
	console.log(t.includes("--json") ? JSON.stringify(c, null, 2) : gt(i, o, c));
	let l = s.filter((e) => e.severity === "error");
	for (let e of l) console.error(lt(`${i}: error ${e.code}: ${rt(e)}`));
	return l.length > 0 ? dt : Q;
}
// src/skill/outlineEntry.ts
process.exitCode = _t(process.argv.slice(2));
