// box.scad – Parametric enclosure for GPS Speedometer Pulse Emulator
//
// Components housed:
//   - ESP32 DevKit v1       (52 × 28 mm, M2.5 mount holes 48 × 23.5 mm pitch)
//   - NEO-6M GPS module     (25 × 35 mm, ceramic antenna 18 × 18 mm on top)
//   - Buck converter        (MP1584 / LM2596, 22 × 17 mm)
//   - Transistor + resistors on small perfboard (20 × 20 mm)
//
// Print in PETG or PLA, 0.2 mm layer, 3 perimeters, 20 % infill.
// M3 heat-set inserts recommended for corner screw holes (or thread directly).
// M2.5 heat-set inserts for ESP32 standoffs.
//
// Two parts in this file – use the render switches at the bottom:
//   SHOW_BOTTOM = true / false
//   SHOW_LID    = true / false

// ── Global parameters ────────────────────────────────────────────────────────
$fn = 48;           // arc smoothness

// Inner cavity dimensions
inner_l = 90;       // X length
inner_w = 65;       // Y width
inner_h = 38;       // Z inner height (bottom part)

wall    = 2.5;      // wall / floor / ceiling thickness
corner_r = 3;       // outer corner radius

lid_h   = 8;        // height of lid (including lip)
lip_h   = 4;        // height of snap/press fit lip
lip_gap = 0.3;      // clearance between lid lip and inner wall

// ── Derived outer dimensions ─────────────────────────────────────────────────
outer_l = inner_l + 2 * wall;
outer_w = inner_w + 2 * wall;
outer_h = inner_h + wall;       // floor included, top open for lid

// ── Render switches ──────────────────────────────────────────────────────────
SHOW_BOTTOM = true;
SHOW_LID    = true;

// ── Component positions (from inner floor origin, bottom-left = 0,0) ─────────
// ESP32 DevKit v1 – left side
esp32_x    = 2;
esp32_y    = 2;
esp32_l    = 52;
esp32_w    = 28;
esp32_mh_x = 2;        // mounting hole inset from module edge
esp32_mh_y = 2.25;
esp32_mh_dx = 48;      // hole pitch X
esp32_mh_dy = 23.5;    // hole pitch Y
esp32_mh_d  = 2.7;     // M2.5 clearance
standoff_h  = 4;       // height of standoff above floor
standoff_od = 5;       // standoff outer diameter

// NEO-6M GPS – right side
gps_x  = 58;
gps_y  = 2;
gps_l  = 35;           // module PCB length
gps_w  = 25;           // module PCB width
ant_x  = gps_x + 8.5; // ceramic antenna X offset from inner origin
ant_y  = gps_y + 3.5; // ceramic antenna Y offset
ant_l  = 18;           // antenna width
ant_w  = 18;           // antenna depth
ant_win_thick = 1.0;   // thinned lid wall over antenna (GPS signal window)

// Buck converter – bottom-left, behind ESP32
buck_x = 2;
buck_y = 34;
buck_l = 22;
buck_w = 17;

// Perfboard (transistor + resistors) – bottom-right
perf_x = 58;
perf_y = 30;
perf_l = 20;
perf_w = 20;

// ── Cable entry holes – in the right short wall (max-X face) ─────────────────
// Three Ø7 mm holes for rubber grommets: 12V in, signal out, GND
cable_d    = 7;
cable_z    = 12;           // height from inner floor
cable_y    = [10, 32, 54]; // Y positions of the three holes

// ── M3 corner screws (bottom body → lid) ─────────────────────────────────────
m3_d       = 3.4;          // clearance drill
m3_boss_d  = 7;            // boss / pad outer diameter
m3_inset   = 5;            // distance from outer corner centre to hole centre

// ── Zip-tie slots in the outer base ──────────────────────────────────────────
zt_w  = 4;                 // slot width
zt_h  = 3;                 // slot height through floor
zt_l  = 20;                // slot length
// Positions: pair on each long side, centred ± 20 mm from middle
zt_y_pairs = [-20, 20];    // Y offset from centre

// ── M3 mounting holes in base (for bolting to moped frame) ───────────────────
mount_d     = 3.4;
mount_boss_d = 8;
mount_inset = 7;           // from outer edge
// Four corners of the outer footprint

// ─────────────────────────────────────────────────────────────────────────────
// Helper modules
// ─────────────────────────────────────────────────────────────────────────────

module rounded_box(l, w, h, r) {
    hull() {
        for (xi = [r, l - r], yi = [r, w - r])
            translate([xi, yi, 0]) cylinder(h=h, r=r);
    }
}

module rounded_box_bottom(l, w, h, r) {
    // Solid rounded-rectangle prism with flat bottom
    rounded_box(l, w, h, r);
}

module m3_corner_bosses(h) {
    // Four M3 boss cylinders at inner corners of outer shell
    positions = [
        [m3_inset,             m3_inset,            ],
        [outer_l - m3_inset,   m3_inset,            ],
        [m3_inset,             outer_w - m3_inset,  ],
        [outer_l - m3_inset,   outer_w - m3_inset,  ]
    ];
    for (p = positions)
        translate([p[0], p[1], 0]) cylinder(h=h, d=m3_boss_d);
}

module m3_corner_holes(h) {
    positions = [
        [m3_inset,             m3_inset,            ],
        [outer_l - m3_inset,   m3_inset,            ],
        [m3_inset,             outer_w - m3_inset,  ],
        [outer_l - m3_inset,   outer_w - m3_inset,  ]
    ];
    for (p = positions)
        translate([p[0], p[1], -1]) cylinder(h=h + 2, d=m3_d);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM PART
// ─────────────────────────────────────────────────────────────────────────────

module bottom() {
    difference() {
        union() {
            // Outer shell (open top)
            difference() {
                rounded_box_bottom(outer_l, outer_w, outer_h, corner_r);
                // Hollow out interior
                translate([wall, wall, wall])
                    cube([inner_l, inner_w, outer_h]); // open top
            }

            // M3 corner bosses (extend from floor)
            translate([0, 0, 0]) m3_corner_bosses(outer_h);

            // ESP32 standoffs
            translate([wall + esp32_x + esp32_mh_x,
                       wall + esp32_y + esp32_mh_y, wall]) {
                for (xi = [0, esp32_mh_dx], yi = [0, esp32_mh_dy])
                    translate([xi, yi, 0])
                        cylinder(h=standoff_h, d=standoff_od);
            }

            // Component trays (raised rim around GPS and buck converter)
            // NEO-6M tray – 1 mm rim, 1 mm floor raised 0 mm (sits on standoffs
            // not needed for GPS; thin retaining lip sufficient)
            translate([wall + gps_x - 1, wall + gps_y - 1, wall])
                difference() {
                    cube([gps_l + 2, gps_w + 2, 2]);
                    translate([1, 1, 1]) cube([gps_l, gps_w, 3]);
                }

            // Buck converter tray
            translate([wall + buck_x - 1, wall + buck_y - 1, wall])
                difference() {
                    cube([buck_l + 2, buck_w + 2, 2]);
                    translate([1, 1, 1]) cube([buck_l, buck_w, 3]);
                }
        }

        // ── Subtractions ────────────────────────────────────────────────────

        // M3 corner screw holes through bosses
        m3_corner_holes(outer_h);

        // M2.5 holes through ESP32 standoffs
        translate([wall + esp32_x + esp32_mh_x,
                   wall + esp32_y + esp32_mh_y, 0]) {
            for (xi = [0, esp32_mh_dx], yi = [0, esp32_mh_dy])
                translate([xi, yi, -1])
                    cylinder(h=standoff_h + wall + 2, d=esp32_mh_d);
        }

        // Cable entry holes – right short wall (X = outer_l face)
        for (cy = cable_y)
            translate([outer_l - wall - 0.01, wall + cy, wall + cable_z])
                rotate([0, 90, 0])
                    cylinder(h=wall + 1, d=cable_d);

        // Zip-tie slots – through outer bottom floor on both long sides
        // Side Y=0
        for (dy = zt_y_pairs)
            translate([outer_l / 2 + dy - zt_l / 2, -0.01, -0.01])
                cube([zt_l, zt_w + 0.01, zt_h + 0.01]);

        // Side Y=outer_w
        for (dy = zt_y_pairs)
            translate([outer_l / 2 + dy - zt_l / 2,
                       outer_w - zt_w, -0.01])
                cube([zt_l, zt_w + 0.01, zt_h + 0.01]);

        // Moped mounting holes through base – 4 corners
        mount_positions = [
            [mount_inset,             mount_inset            ],
            [outer_l - mount_inset,   mount_inset            ],
            [mount_inset,             outer_w - mount_inset  ],
            [outer_l - mount_inset,   outer_w - mount_inset  ]
        ];
        for (p = mount_positions)
            translate([p[0], p[1], -1])
                cylinder(h=wall + 2, d=mount_d);
    }

    // Countersunk pads (raised boss on underside not needed – flat base is fine)
    // Label emboss on outer side wall
    translate([wall + 2, -0.4, wall + 4])
        rotate([90, 0, 0])
            linear_extrude(height=0.5)
                text("GPS SPEEDOMETER", size=5, font="Liberation Sans:style=Bold");
}

// ─────────────────────────────────────────────────────────────────────────────
// LID
// ─────────────────────────────────────────────────────────────────────────────

module lid() {
    // Lid sits on top of bottom part. Origin at lid bottom face.
    // Lid outer footprint matches bottom outer footprint exactly.
    lip_thick = wall;  // lip wall thickness

    difference() {
        union() {
            // Top plate
            rounded_box_bottom(outer_l, outer_w, wall, corner_r);

            // Downward lip (press-fit inside inner walls)
            translate([wall - lip_thick + lip_gap,
                       wall - lip_thick + lip_gap, -lip_h])
                cube([inner_l + 2 * lip_thick - 2 * lip_gap,
                      inner_w + 2 * lip_thick - 2 * lip_gap,
                      lip_h]);

            // M3 bosses on lid (same X,Y corners as bottom)
            m3_corner_bosses(wall);

            // "GPS" raised label at antenna window position
            translate([wall + ant_x - wall, wall + ant_y + ant_w + 1, wall])
                linear_extrude(height=0.6)
                    text("GPS", size=4, font="Liberation Sans:style=Bold");
        }

        // ── Subtractions ────────────────────────────────────────────────────

        // Hollow out lip interior (lip is a frame, not solid)
        translate([wall + lip_gap, wall + lip_gap, -lip_h - 0.01])
            cube([inner_l - 2 * lip_gap, inner_w - 2 * lip_gap, lip_h + 0.01]);

        // M3 screw holes through lid bosses
        m3_corner_holes(wall);

        // GPS antenna window: thin the lid to ant_win_thick over antenna area
        // The full ceiling is 'wall' thick; we remove (wall - ant_win_thick) from inside
        thin_depth = wall - ant_win_thick;
        translate([wall + ant_x, wall + ant_y, ant_win_thick])
            cube([ant_l, ant_w, thin_depth + 0.01]);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────

if (SHOW_BOTTOM) {
    color("SteelBlue", 0.85) bottom();
}

if (SHOW_LID) {
    // Place lid above bottom for preview; flip upside-down to print flat
    separation = SHOW_BOTTOM ? outer_h + lid_h + 5 : 0;
    translate([0, 0, separation])
        color("LightSteelBlue", 0.85) lid();
}
