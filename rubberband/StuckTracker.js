"use strict";

if (typeof simulatedTea === 'undefined')
{
    var simulatedTea = {}
}
if (typeof simulatedTea.CollisionAware === 'undefined')
{
    simulatedTea.CollisionAware = {}
}

(function ()
{
    var StuckTracker = function ()
    {
        this.unmovedTime = 0; // sec
    }

    var stProto = StuckTracker.prototype;

    stProto.registerUnmoved = function (dt)
    {
        this.unmovedTime += dt;
        if (this.unmovedTime > 0.45)
        {
            this.unmovedTime = 0.33 - 2*dt - 0.005;
        }
    }

    stProto.registerFreed = function ()
    {
        this.unmovedTime = 0;
    }

    stProto.isStuck = function ()
    {
        return this.unmovedTime > 0.33;
    }

    simulatedTea.CollisionAware.StuckTracker = StuckTracker;
    if ( typeof module === "object" && typeof module.exports === "object" )
    {
        module.exports = StuckTracker;
    }
})();
