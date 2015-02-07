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

        var diff = {
            x: this.inst.x - this.lastX,
            y: this.inst.y - this.lastY
        };

        if (!movementNegligible(diff) && this.enabled) // resolve collision & pickup counterspeed
        {
            if (this.isMovingSlow(diff))
            {
                this.oneStepOrCollision(diff);
            }
            // else should raycast. phew. --- or multisample !!
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

    behinstProto.isMovingSlow = function (diff)
    {
        return (Math.abs(diff.x) < this.inst.bbox.width()
            && Math.abs(diff.y) < this.inst.bbox.height())
    }

    behinstProto.oneStepOrCollision = function (diff)
    {
        this.inst.set_bbox_changed();
        var collobj = this.runtime.testOverlapSolid(this.inst);
        if (collobj)
        {
            this.runtime.pushOutSolidNearest(this.inst, Math.sqrt(diff.x*diff.x + diff.y*diff.y) + toleratedNumericError);
            this.runtime.registerCollision(this.inst, collobj);
            this.dx += this.elasticity*(this.inst.x - (this.lastX + diff.x))/this.medianDt;
            this.dy += this.elasticity*(this.inst.y - (this.lastY + diff.y))/this.medianDt;
            this.ticksToPush += 1;
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
