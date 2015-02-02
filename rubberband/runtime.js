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

    var toleratedNumericError = 1;

    var behinstProto = behaviorProto.Instance.prototype;

    behinstProto.onCreate = function()
    {
        this.enabled = this.properties[0];

        this.elasticity = 0.1;
        this.stuckTime = 0;

        this.dx = 0;
        this.dy = 0;
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
            "dx": this.dx,
            "dy": this.dy,
            "lastX": this.lastX,
            "lastY": this.lastY,
            "medianDt": this.medianDt,
            "lastDts": this.lastDts
        };
    };

    behinstProto.loadFromJSON = function (o)
    {
        this.enabled = o["enabled"];
        this.dx = o["dx"];
        this.dy = o["dy"];
        this.lastX = o["lastX"];
        this.lastY = o["lastY"];
        this.medianDt = o["medianDt"];
        this.lastDts = o["lastDts"];

        this.elasticity = 0.1;
    };

    behinstProto.tick = function ()
    {
        this.getLast5MedianDt();
        this.pickupExternalImpulse();
        var diff = { x: 0, y: 0 };

        if (this.stuckTracker.isStuck()) {window.console.log('stuck '+this.stuckTracker.unmovedTime)};
        var diff = {
            x: this.inst.x - this.lastX,
            y: this.inst.y - this.lastY
        };
        if (!movementNegligible(diff))  // save draw calls (and collisions) if nothing moves
        {
            if (this.collisionsEnabled)
            {
                this.inst.update_bbox();
                if (this.isMovingSlow(diff))
                {
                    this.oneStepOrCollision(diff);
                }
            }
        }

        window.console.log('measured movement - x: '+effectiveMove.x+', y: '+effectiveMove.y);
        if (movementNegligible(effectiveMove))
        {
            this.stuckTracker.registerUnmoved(this.medianDt);
        }
        else
        {
            this.stuckTracker.registerFreed();
        }

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

    behinstProto.pickupExternalImpulse = function ()
    {
        if (this.lastX !== this.inst.x || this.lastY !== this.inst.y) // there are there other sources of movement
        {
            var delta = this.getPositionDelta();
            this.dx = (this.dx + delta.x/this.medianDt)/2;
            this.dy = (this.dy + delta.y/this.medianDt)/2;
        }
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

    behinstProto.moveAndOnCollisionDo = function (diff, collisionHandler)
    {
        this.inst.x += diff.x;
        this.inst.y += diff.y;
        this.inst.set_bbox_changed();
        var collobj = this.runtime.testOverlapSolid(this.inst);
        if (collobj)
        {
            collisionHandler.call(this, diff, collobj);
        }
    }

    behinstProto.oneStepOrCollision = function (diff)
    {
        this.moveAndOnCollisionDo(diff, function (diff, collobj) {
            this.runtime.pushOutSolid(this.inst, -diff.x, -diff.y, Math.sqrt(diff.x*diff.x + diff.y*diff.y) + toleratedNumericError);
            this.runtime.registerCollision(this.inst, collobj);
            var pushbackX = this.inst.x - this.lastX - diff.x;
            var pushbackY = this.inst.y - this.lastY - diff.y;
            window.console.log('moveing back via collision: x: '+pushbackX+', y: '+pushbackY);
            this.lastX = this.inst.x;
            this.lastY = this.inst.y;
            this.calculateBounceOffSpeed(collobj);
            //var postCollisionDelta = this.getPositionDelta();
            //if (!movementNegligible(postCollisionDelta))
            //{
            //    this.inst.set_bbox_changed();
            //}
        });
    }

    behinstProto.calculateBounceOffSpeed = function (c)
    {
        var constellation = this.detectConstellationWith(c);
        this.flipOneSpeedComponentAwayFrom(c, constellation);       // try angled bounce first
        this.applyFrictionToOtherSpeedComponent(constellation);

        if (Math.abs(this.dx) > 0.7 || Math.abs(this.dy > 0.7))     // validate angled bounce is working
        {
            var speed = Math.sqrt(this.dx*this.dx + this.dy*this.dy);
            var testMoveDistance = 2; // pixel // could depend on remaining distance not yet moved into collobj ??
            //window.console.log('speed: '+speed);
            var deltaX =  this.dx / speed * testMoveDistance;
            var deltaY =  this.dy / speed * testMoveDistance;
            window.console.log('test move: x: '+deltaX+', y: '+deltaY);
            this.inst.x += deltaX;
            this.inst.y += deltaY;
            //this.inst.set_bbox_changed();
            //var collobj = this.runtime.testOverlapSolid(this.inst);

            if (false)  // angled bounce failed - switch to reflect
            {
                window.console.log('validation failed');
                this.inst.x = this.lastX;
                this.inst.y = this.lastY;
                if (constellation === 'horizontal')
                {
                    this.dy = -this.elasticity*this.dy;
                }
                else
                {
                    this.dx = -this.elasticity*this.dx;
                }
            }
        }
    }

    behinstProto.detectConstellationWith = function (c)
    {
        var toTheRight = this.inst.x > c.x;
        var below = this.inst.y > c.y;
        if (toTheRight === below)
        {
            var slopeDiagonalRightDown = (c.bquad.bry - c.bquad.midY())/(c.bquad.brx - c.bquad.midX());
            var slopeToInstance = Math.abs(this.inst.y - c.bquad.midY())/(Math.abs(this.inst.x - c.bquad.midX()) + 1);
            if ( slopeDiagonalRightDown < slopeToInstance)
            {
                return 'vertical';
            }
            else
            {
                return 'horizontal';
            }
        }
        else
        {
            var slopeDiagonalRightUp = (c.bquad.try_ - c.bquad.midY())/(c.bquad.trx - c.bquad.midX());
            var slopeToInstance = -Math.abs(this.inst.y - c.bquad.midY())/(Math.abs(this.inst.x - c.bquad.midX()) + 1);
            if ( slopeDiagonalRightUp < slopeToInstance )
            {
                return 'horizontal';
            }
            else
            {
                return 'vertical';
            }
        }
    }

    behinstProto.flipOneSpeedComponentAwayFrom = function (c, direction)
    {
        if (direction === 'horizontal' && (this.inst.x - c.x)*this.dx < 0 )
        {
            this.dx = -this.elasticity*this.dx;
        }
        else if (direction === 'vertical' && (this.inst.y - c.y)*this.dy < 0 )
        {
            this.dy = -this.elasticity*this.dy;
        }
    }

    behinstProto.applyFrictionToOtherSpeedComponent = function (direction)
    {
        if (direction === 'horizontal')
        {
            this.dy = 0.5*this.dy; // XXX 0.5 ===> this.friction
        }
        else if (direction === 'vertical')
        {
            this.dx = 0.5*this.dx;
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
