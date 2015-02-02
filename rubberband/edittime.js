function GetBehaviorSettings()
{
    return {
        "name":        "Moving Collider",
        "id":          "CollisionAware",
        "version":     "0.1.0",
        "description": "Track own movement and do collision checks to respect solid objects in the scene",
        "author":      "simulated_tea",
        "help url":    "https://github.com/simulated-tea/Construct2-RubberBand",
        "category":    "Movements",
        "dependency":  "StuckTracker.js",
        "flags":       0
    };
};

AddCondition(2, 0, "Is enabled", "", "Is {my} enabled", "Test if the behavior is currently enabled.", "IsEnabled");

AddComboParamOption("Disabled");
AddComboParamOption("Enabled");
AddComboParam("State", "Set whether to enable or disable the behavior.");
AddAction(2, af_none, "Set enabled", "", "Set {my} <b>{0}</b>", "Set whether this behavior is enabled.", "setEnabled");

ACESDone();

var property_list = [
    new cr.Property(ept_combo, "Initial State", "Enabled", "Whether to initially have the behavior enabled or disabled", "Disabled|Enabled")
];

function CreateIDEBehaviorType()
{
    return new IDEBehaviorType();
}

function IDEBehaviorType()
{
    assert2(this instanceof arguments.callee, "Constructor called as a function");
}

IDEBehaviorType.prototype.CreateInstance = function(instance)
{
    return new IDEInstance(instance, this);
}

function IDEInstance(instance, type)
{
    assert2(this instanceof arguments.callee, "Constructor called as a function");

    this.instance = instance;
    this.type = type;

    this.properties = {};

    for (var i = 0; i < property_list.length; i++)
        this.properties[property_list[i].name] = property_list[i].initial_value;
}

IDEInstance.prototype.OnCreate = function()
{
}

IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
}
