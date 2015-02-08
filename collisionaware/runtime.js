// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

cr.behaviors.CollisionAware = function(runtime)
{
    this.runtime = runtime;
};

(function ()
{
    var behaviorProto = cr.behaviors.CollisionAware.prototype;

    behaviorProto.Type = function(behavior, objtype)
    {
        this.behavior = behavior;
        this.objtype = objtype;
        this.runtime = behavior.runtime;
    };

    var behtypeProto = behaviorProto.Type.prototype;

    behtypeProto.onCreate = function()
    {
    };

    behaviorProto.Instance = function(type, inst)
    {
        this.type = type;
        this.behavior = type.behavior;
        this.inst = inst;
        this.runtime = type.runtime;
        this.stuckTracker = new simulatedTea.CollisionAware.StuckTracker(); // XXX this will break at minification
    };

    var toleratedNumericError = 2;

    var behinstProto = behaviorProto.Instance.prototype;

    behinstProto.onCreate = function()
    {
        this.enabled = this.properties[0];

        this.elasticity = 1;

        this.externDx = 0;
        this.externDy = 0;
        this.dx = 0;
        this.dy = 0;
        this.ticksToPush = 0;
        this.lastX = this.inst.x;
        this.lastY = this.inst.y;
        this.medianDt = 0.016; // 60 FPS
        this.lastDts = [0.016, 0.016, 0.016, 0.16, 0.16];
    };

    behinstProto.onDestroy = function ()
    {
    };

    behinstProto.saveToJSON = function ()
    {
        return {
            "enabled": this.enabled,
            "externDx": this.externDx,
            "externDy": this.externDy,
            "dx": this.dx,
            "dy": this.dy,
            "ticksToPush": this.ticksToPush,
            "lastX": this.lastX,
            "lastY": this.lastY,
            "medianDt": this.medianDt,
            "lastDts": this.lastDts
        };
    };

    behinstProto.loadFromJSON = function (o)
    {
        this.enabled = o["enabled"];
        this.externDx = o["externDx"];
        this.externDy = o["externDy"];
        this.dx = o["dx"];
        this.dy = o["dy"];
        this.ticksToPush = o["ticksToPush"];
        this.lastX = o["lastX"];
        this.lastY = o["lastY"];
        this.medianDt = o["medianDt"];
        this.lastDts = o["lastDts"];

        this.elasticity = 1;
    };

    behinstProto.tick = function ()
    {
        this.getLast5MedianDt();
        this.measureExternalImpuls();
        //this.applyReflectionSpeed();

        var diff = {
            x: this.inst.x - this.lastX,
            y: this.inst.y - this.lastY
        };

        if (!movementNegligible(diff) && this.enabled) // resolve collision & compute counterspeed
        {
            this.inst.update_bbox();
            if (this.isMovingSlow(diff))
            {
                this.lastCheckedStep(diff);
            }
            else
            {
                this.multiSamplePath(diff);
                // L> cannot recognize curvature
                //    gets very expensive for fast, small objects
                //    (would need a raycast-like check for that)
            }
            this.inst.set_bbox_changed(); // probably not needed
        }

        //if (movementNegligible(diff))
        //{
        //    this.stuckTracker.registerUnmoved(this.medianDt);
        //}
        //else
        //{
        //    this.stuckTracker.registerFreed();
        //}

        this.lastX = this.inst.x;
        this.lastY = this.inst.y;
    }

    behinstProto.applyReflectionSpeed = function ()
    {
        if (this.ticksToPush > 0)
        {
            this.inst.x += this.dx*this.medianDt;
            this.inst.y += this.dy*this.medianDt;
            this.ticksToPush -= 1;
        }
        else
        {
            this.dx = 0;
            this.dy = 0;
        }
    }

    behinstProto.isMovingSlow = function (diff)
    {
        return (Math.abs(diff.x) < this.inst.bbox.width()
            && Math.abs(diff.y) < this.inst.bbox.height())
    }

    behinstProto.lastCheckedStep = function (diff)
    {
        var collobj = this.runtime.testOverlapSolid(this.inst);
        if (collobj)
        {
            window.console.log('collision');
            this.resolveCollision(diff, collobj, Math.sqrt(diff.x*diff.x + diff.y*diff.y))
        }
    }

    behinstProto.multiSamplePath = function (diff)
    {
        var unit = 5,
            stepWidth = Math.max(Math.min(this.inst.bbox.width(), this.inst.bbox.height()) - unit, unit),
            // L> stupid workaround for missing raycast solution for small fast objects
            targetDistance = Math.sqrt(diff.x*diff.x + diff.y*diff.y);
        for (
            var stepDistance = unit;
            stepDistance + unit < targetDistance;
            stepDistance += stepWidth
        )
        {
            this.inst.x = this.lastX + stepDistance/targetDistance*diff.x;
            this.inst.y = this.lastY + stepDistance/targetDistance*diff.y;
            var collobj = this.runtime.testOverlapSolid(this.inst);
            if (collobj)
            {
                this.resolveCollision(diff, collobj, stepWidth);
                return;
            }
        }
        dot.x = this.inst.x;
        dot.y = this.inst.y;
        dot.set_bbox_changed();
        this.lastCheckedStep(diff);
    }

    behinstProto.resolveCollision = function (diff, collobj, maxDistance)
    {
        this.runtime.pushOutSolid(this.inst, -diff.x, -diff.y, maxDistance + toleratedNumericError);
        this.runtime.registerCollision(this.inst, collobj);
        var pushoutX = this.inst.x - (this.lastX + diff.x);
        var pushoutY = this.inst.y - (this.lastY + diff.y);
        // pushout direction is mostly off anglewise in positive direction
        // could try a workaround by manually continuing the pushout spiral (as circle, more likely)
        // this.testAndDecideReflectionSpeed(diff, pushoutX, pushoutY); // work postponed
    }

    behinstProto.testAndDecideReflectionSpeed = function (diff, pbx, pby)
    {
        this.dx += this.elasticity*(pbx)/this.medianDt;
        this.dy += this.elasticity*(pby)/this.medianDt;
        this.ticksToPush += 1;
    }

    behinstProto.getLast5MedianDt = function ()
    {
        var dt = this.runtime.getDt(this.inst);
        this.lastDts.pop();
        this.lastDts.unshift(dt);
        var sample = this.lastDts.slice().sort(function(a,b) {return a-b});
        this.medianDt = sample[2];
    }

    behinstProto.measureExternalImpuls = function ()
    {
        if (this.otherSourcesOfMovementExist())
        {
            var delta = this.getPositionDelta();
            this.externDx = (this.externDx + delta.x/this.medianDt)/2;
            this.externDy = (this.externDy + delta.y/this.medianDt)/2;
        }
    }

    behinstProto.otherSourcesOfMovementExist = function ()
    {
        return this.lastX !== this.inst.x || this.lastY !== this.inst.y
    }

    function movementNegligible (vector)
    {
        return (Math.abs(vector.x) < 0.1 && Math.abs(vector.y) < 0.1)
    }

    behinstProto.getPositionDelta = function ()
    {
        return {
            x: this.inst.x - this.lastX,
            y: this.inst.y - this.lastY
        }
    }

    /**BEGIN-PREVIEWONLY**/
    behinstProto.getDebuggerValues = function (propsections)
    {
        propsections.push({
            "title": this.type.name,
            "properties": [
                {"name": "Velocity.x", "value": this.dx, "readonly": true},
                {"name": "Velocity.y", "value": this.dy, "readonly": true},
                {"name": "Enabled", "value": !! this.enabled},
            ]
        });
    };

    behinstProto.onDebugValueEdited = function (header, name, value)
    {
        if (name === "Enabled")
            this.enabled = value;
    };
    /**END-PREVIEWONLY**/

    function Cnds() {};

    Cnds.prototype.IsEnabled = function () { return this.enabled }

    behaviorProto.cnds = new Cnds();

    function Acts() {};

    Acts.prototype.setEnabled = function (en)
    {
        this.enabled = (en === 1);
        if (!this.enabled)
        {
            this.dx = 0;
            this.dy = 0;
        }
    };

    behaviorProto.acts = new Acts();

    function Exps() {};

    behaviorProto.exps = new Exps();

}());
