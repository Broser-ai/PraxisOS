// Archive port: Drive praxisos/modules/foot-scanner/openscad/orthotic.scad (juli 2026)
// PraxisOS parametric orthotic template
// This is the "canonical" version; the CLI/API-emitted file interpolates
// values from the biomechanical report at generation time.
//
// Customise below and run:
//     openscad -o preview.stl orthotic.scad

length      = 265;   // foot length in mm
width_fore  = 100;   // forefoot width in mm
width_heel  = 65;    // heel width in mm
arch_rise   = 8;     // medial arch dome height in mm
heel_cup    = 12;    // heel cup rim height in mm
heel_wedge  = 0;     // heel wedge angle in degrees (medial +)
fore_wedge  = 0;
met_pad     = false; // metatarsal pad on/off
met_pad_thk = 3;
top_cover   = "poron";
$fn         = 96;

module baseplate() {
    hull() {
        translate([0, 0, 2])              cylinder(h=6, r=width_heel/2);
        translate([0, length*0.55, 2])    cylinder(h=6, r=(width_fore+2)/2);
        translate([0, length,      2])    cylinder(h=6, r=width_fore/2*0.6);
    }
}

module heel_cup() {
    difference() {
        cylinder(h=heel_cup, r=width_heel/2);
        translate([0, 0, -0.1]) cylinder(h=heel_cup+0.2, r=width_heel/2 - 5);
    }
}

module arch_dome() {
    translate([-width_fore/4, length*0.42, 4])
        scale([1.0, 2.4, arch_rise/8])
            sphere(r=8);
}

module met_pad_bump() {
    translate([-2, length*0.72, 6])
        scale([1.6, 1.0, met_pad_thk/6])
            sphere(r=6);
}

module wedge_heel() {
    if (heel_wedge != 0) {
        translate([0, 0, 0])
            rotate([heel_wedge, 0, 0])
                translate([0, 0, -3])
                    cube([width_heel, length*0.3, 3], center=false);
    }
}

difference() {
    union() {
        baseplate();
        heel_cup();
        arch_dome();
        if (met_pad) met_pad_bump();
        wedge_heel();
    }
    translate([0, length/2, 12]) scale([1.4, 2.6, 0.6]) sphere(r=25);
}
