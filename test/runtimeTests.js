"use strict";

var assert = require("./helper/better-assert")

describe('CollisionAware - runtime', function(){
    global.cr = require('./helper/crMock');
    global.window = require('./helper/browserMock');
    global.assert2 = function() {};
    require("./../rubberband/runtime")
    global.simulatedTea = {};
    global.simulatedTea.CollisionAware = {};
    global.simulatedTea.CollisionAware.StuckTracker = require("./../rubberband/StuckTracker")

    var behavior = new cr.behaviors.CollisionAware({
            iam: 'runtime',
            getDt: function() { return 0.016; },
            testOverlapSolid: function() { return null; }
        }),
        type = new behavior.Type(behavior, {iam: 'objtype'}),
        actions = behavior.acts,
        defaultProperties = {
            enabled: true
        };

    xdescribe('calculateBounceOffSpeed', function() {
        var c = {
            bquad: { tlx: -10, tly: -10, trx: 10, try_: -10, blx: -10, bly: 10, brx: 10, bry: 10,
                midX: function() { return 0; }, midY: function() { return 0; }
            }};

        [
        { inst: { x:   5, y: -15 }, dx: - 5, dy:  10, expect: { dx: - 5, dy: -10 }, testname: '1 o\'clock innward' },
        { inst: { x:   5, y: -15 }, dx:   5, dy:  10, expect: { dx:   5, dy: -10 }, testname: '1 o\'clock outward' },
        { inst: { x:  15, y: - 5 }, dx: -10, dy:   5, expect: { dx:  10, dy:   5 }, testname: '2 o\'clock innward' },
        { inst: { x:  15, y: - 5 }, dx: -10, dy: - 5, expect: { dx:  10, dy: - 5 }, testname: '2 o\'clock outward' },
        { inst: { x:  15, y:   5 }, dx: -10, dy: - 5, expect: { dx:  10, dy: - 5 }, testname: '4 o\'clock innward' },
        { inst: { x:  15, y:   5 }, dx: -10, dy:   5, expect: { dx:  10, dy:   5 }, testname: '4 o\'clock outward' },
        { inst: { x:   5, y:  15 }, dx: - 5, dy: -10, expect: { dx: - 5, dy:  10 }, testname: '5 o\'clock innward' },
        { inst: { x:   5, y:  15 }, dx:   5, dy: -10, expect: { dx:   5, dy:  10 }, testname: '5 o\'clock outward' },
        { inst: { x: - 5, y:  15 }, dx:   5, dy: -10, expect: { dx:   5, dy:  10 }, testname: '7 o\'clock innward' },
        { inst: { x: - 5, y:  15 }, dx: - 5, dy: -10, expect: { dx: - 5, dy:  10 }, testname: '7 o\'clock outward' },
        { inst: { x: -15, y:   5 }, dx:  10, dy: - 5, expect: { dx: -10, dy: - 5 }, testname: '8 o\'clock innward' },
        { inst: { x: -15, y:   5 }, dx:  10, dy:   5, expect: { dx: -10, dy:   5 }, testname: '8 o\'clock outward' },
        { inst: { x: -15, y: - 5 }, dx:  10, dy:   5, expect: { dx: -10, dy:   5 }, testname: '10 o\'clock innward' },
        { inst: { x: -15, y: - 5 }, dx:  10, dy: - 5, expect: { dx: -10, dy: - 5 }, testname: '10 o\'clock outward' },
        { inst: { x: - 5, y: -15 }, dx:   5, dy:  10, expect: { dx:   5, dy: -10 }, testname: '11 o\'clock innward' },
        { inst: { x: - 5, y: -15 }, dx: - 5, dy:  10, expect: { dx: - 5, dy: -10 }, testname: '11 o\'clock innward' },


        { inst: { x:   0, y: -15 }, dx:   5, dy:  10, expect: { dx:   5, dy: -10 }, testname: '12 o\'clock rightward' }
        ].forEach(function (this_) {
            it(' test for '+this_.testname, function () {
                if (!this_.elasticity) { this_.elasticity = 1; }
                if (!this_.inst.set_bbox_changed) { this_.inst.set_bbox_changed = function() { return null; } }
                if (!this_.runtime) { this_.runtime = behavior.runtime; }

                behavior.Instance.prototype.calculateBounceOffSpeed.call(this_, c);

                assert(this_.dx == this_.expect.dx, this_.dx+' == '+this_.expect.dx);
                assert(this_.dy == this_.expect.dy, this_.dy+' == '+this_.expect.dy);
            });
        });
    });
});
