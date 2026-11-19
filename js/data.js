// Chiikawa Character Creator - Complete Game Data (1-to-1 Video Match)

const GAME_DATA = {
  // 18 Body Color Swatches (2 rows of 9, last slot in UI is rainbow custom picker)
  bodyColors: [
    '#FFFFFF', '#FFF8E7', '#FFE8D6', '#FFD5C2', '#F8BBD0', '#F48FB1', '#E1BEE7', '#B39DDB', '#90CAF9',
    '#80DEEA', '#A5D6A7', '#E6EE9C', '#FFF59D', '#FFE082', '#BCAAA4', '#8D6E63', '#546E7A'
  ],

  // 18 Point Color Swatches (for ears, tail, and markings)
  pointColors: [
    '#3E322E', '#5D4037', '#8D6E63', '#BCAAA4', '#FFB74D', '#FF8A65', '#F06292', '#BA68C8', '#7986CB',
    '#64B5F6', '#4FC3F7', '#4DB6AC', '#81C784', '#AED581', '#FFD54F', '#E57373', '#90A4AE'
  ],

  body: {
    shapes: [
      { id: 'shape_slim', label: 'Slim', scaleX: 0.86, scaleY: 1.05 },
      { id: 'shape_normal', label: 'Normal', scaleX: 1.0, scaleY: 1.0 },
      { id: 'shape_chubby', label: 'Chubby', scaleX: 1.15, scaleY: 0.95 }
    ],
    patterns: [
      { id: 'pat_none', label: 'None' },
      { id: 'pat_belly', label: 'Belly Patch' },
      { id: 'pat_bib', label: 'Bib' },
      { id: 'pat_stripes', label: 'Stripes' },
      { id: 'pat_spots', label: 'Spots' },
      { id: 'pat_heart', label: 'Belly Heart' },
      { id: 'pat_back', label: 'Back Patch' },
      { id: 'pat_pants', label: 'Pants' },
      { id: 'pat_gloves', label: 'Gloves & Socks' }
    ]
  },

  face: {
    eyes: [
      { id: 'eye_round', label: 'Basic' },
      { id: 'eye_sparkle', label: 'Sparkle' },
      { id: 'eye_happy', label: 'Happy' },
      { id: 'eye_wink', label: 'Wink' },
      { id: 'eye_sleepy', label: 'Sleepy' },
      { id: 'eye_dot', label: 'Button' },
      { id: 'eye_tear', label: 'Teary' },
      { id: 'eye_calm', label: 'Calm' },
      { id: 'eye_star', label: 'Starry' },
      { id: 'eye_crying', label: 'Crying' },
      { id: 'eye_dizzy', label: 'Dizzy' },
      { id: 'eye_heart', label: 'Heart Eyes' },
      { id: 'eye_angry', label: 'Determined' },
      { id: 'eye_cross', label: 'Cross (> <)' },
      { id: 'eye_squint', label: 'Smiling (^ ^)' },
      { id: 'eye_sparkle_big', label: 'Starlight' },
      { id: 'eye_glance', label: 'Side Glance' }
    ],
    eyebrows: [
      { id: 'brow_follow', label: 'Match Eyes' },
      { id: 'brow_short', label: 'Short' },
      { id: 'brow_smile', label: 'Curved' },
      { id: 'brow_droop', label: 'Droopy' },
      { id: 'brow_angry', label: 'Raised' },
      { id: 'brow_thick', label: 'Thick' }
    ],
    mouths: [
      { id: 'mouth_follow', label: 'Match Eyes' },
      { id: 'mouth_small', label: 'Small' },
      { id: 'mouth_cat', label: 'Cat' },
      { id: 'mouth_open', label: 'Smile' },
      { id: 'mouth_wavy', label: 'Wavy' },
      { id: 'mouth_dot', label: 'Dot' },
      { id: 'mouth_fang', label: 'Snaggletooth' },
      { id: 'mouth_surprised', label: 'Gasp' },
      { id: 'mouth_cry', label: 'Wobbly Cry' },
      { id: 'mouth_smirk', label: 'Smirk' },
      { id: 'mouth_tongue', label: 'Tongue Out' },
      { id: 'mouth_open_smile', label: 'Big Smile' },
      { id: 'mouth_triangle', label: 'Triangle' },
      { id: 'mouth_flat', label: 'Deadpan' }
    ],
    markings: [
      { id: 'mark_none', label: 'None' },
      { id: 'mark_eyepatch', label: 'Eye Patch' },
      { id: 'mark_raccoon', label: 'Raccoon' },
      { id: 'mark_half', label: 'Half Face' },
      { id: 'mark_star', label: 'Forehead Star' },
      { id: 'mark_tiger', label: 'Tiger Stripes' },
      { id: 'mark_freckles', label: 'Freckles' },
      { id: 'mark_muzzle', label: 'Muzzle' },
      { id: 'mark_maro', label: 'Maro Brows' },
      { id: 'mark_heart', label: 'Cheek Heart' },
      { id: 'mark_cross', label: 'Cheek Bandage' },
      { id: 'mark_whiskers', label: 'Cat Whiskers' },
      { id: 'mark_lightning', label: 'Lightning' },
      { id: 'mark_panda', label: 'Panda Rings' },
      { id: 'mark_spot', label: 'Puppy Eye Spot' },
      { id: 'mark_clover', label: 'Four-Leaf Clover' },
      { id: 'mark_teardrop', label: 'Teardrop' }
    ],
    glasses: [
      { id: 'glasses_none', label: 'None' },
      { id: 'glasses_round', label: 'Round Glasses' },
      { id: 'glasses_heart', label: 'Heart Shades' },
      { id: 'glasses_star', label: 'Star Shades' },
      { id: 'glasses_monocle', label: 'Monocle' },
      { id: 'glasses_retro', label: 'Square Frames' },
      { id: 'glasses_sunglasses', label: 'Cool Shades' },
      { id: 'glasses_pixel', label: 'Pixel Shades' },
      { id: 'glasses_goggles', label: 'Aviator Goggles' },
      { id: 'glasses_dizzy', label: 'Swirl Glasses' },
      { id: 'glasses_half', label: 'Half-Moon' },
      { id: 'glasses_cat', label: 'Cat-Eye Shades' },
      { id: 'glasses_sleep', label: 'Sleep Mask' }
    ],
    blushStyles: [
      { id: 'blush_classic', label: 'Classic' },
      { id: 'blush_heart', label: 'Hearts' },
      { id: 'blush_star', label: 'Stars' },
      { id: 'blush_sparkle', label: 'Sparkle' },
      { id: 'blush_flushed', label: 'Flushed' },
      { id: 'blush_stripes', label: 'Manga Lines' },
      { id: 'blush_dots', label: 'Dot Clusters' },
      { id: 'blush_cat', label: 'Whiskers Blush' },
      { id: 'blush_spiral', label: 'Swirl Blush' },
      { id: 'blush_flower', label: 'Sakura Flowers' },
      { id: 'blush_rainbow', label: 'Rainbow Glow' },
      { id: 'blush_none', label: 'None' }
    ]
  },

  head: {
    ears: [
      { id: 'ear_round', label: 'Round Ears' },
      { id: 'ear_small', label: 'Small Ears' },
      { id: 'ear_bear', label: 'Bear Ears' },
      { id: 'ear_big', label: 'Big Ears' },
      { id: 'ear_cat', label: 'Cat Ears' },
      { id: 'ear_rabbit', label: 'Rabbit Ears' },
      { id: 'ear_lop', label: 'Lop Ears' },
      { id: 'ear_puppy', label: 'Puppy Ears' },
      { id: 'ear_momonga', label: 'Fluffy Ears' },
      { id: 'ear_folded', label: 'Folded Ears' },
      { id: 'ear_ram', label: 'Curled Horns' },
      { id: 'ear_side', label: 'Side Ears' },
      { id: 'ear_antenna', label: 'Antennae' },
      { id: 'ear_fin', label: 'Fin Ears' },
      { id: 'ear_leaf', label: 'Leaf Ears' },
      { id: 'ear_devil', label: 'Devil Wings' },
      { id: 'ear_curled', label: 'Curled Cat' },
      { id: 'ear_dragon', label: 'Dragon Horns' },
      { id: 'ear_bunny_droop', label: 'Floppy Bunny' },
      { id: 'ear_mouse', label: 'Round Mouse' },
      { id: 'ear_deer', label: 'Deer Antlers' },
      { id: 'ear_pointed', label: 'Elf / Pixie' },
      { id: 'ear_fluffy_top', label: 'Top Tuft Ears' },
      { id: 'ear_none', label: 'No Ears' }
    ],
    accessories: [
      { id: 'acc_none', label: 'None' },
      { id: 'acc_ribbon', label: 'Ribbon' },
      { id: 'acc_beret', label: 'Beret' },
      { id: 'acc_flower', label: 'Flower Pin' },
      { id: 'acc_crown', label: 'Mini Crown' },
      { id: 'acc_sprout', label: 'Sprout' },
      { id: 'acc_star', label: 'Star Pin' },
      { id: 'acc_halo', label: 'Halo' },
      { id: 'acc_horns', label: 'Devil Horns' },
      { id: 'acc_beanie', label: 'Beanie' },
      { id: 'acc_strawhat', label: 'Straw Hat' },
      { id: 'acc_witch', label: 'Witch Hat' },
      { id: 'acc_headphones', label: 'Headphones' },
      { id: 'acc_heartpin', label: 'Heart Pin' },
      { id: 'acc_bandaid', label: 'Band-Aid' }
    ],
    hair: [
      { id: 'hair_none', label: 'None' },
      { id: 'hair_tuft', label: 'Spiky Tuft' },
      { id: 'hair_bangs', label: 'Bangs' },
      { id: 'hair_curl', label: 'Curly Hair' },
      { id: 'hair_parted', label: 'Parted' },
      { id: 'hair_fluffy', label: 'Fluffy Hair' },
      { id: 'hair_ahoge', label: 'Ahoge' },
      { id: 'hair_twinpuffs', label: 'Twin Puffs' },
      { id: 'hair_sideswept', label: 'Side-Swept' },
      { id: 'hair_pigtails', label: 'Pigtails' },
      { id: 'hair_mohawk', label: 'Mohawk' },
      { id: 'hair_swoop', label: 'Front Swoop' },
      { id: 'hair_bob', label: 'Curved Bob' },
      { id: 'hair_messy', label: 'Messy Bedhead' },
      { id: 'hair_braid', label: 'Side Braid' },
      { id: 'hair_ponytail', label: 'High Ponytail' },
      { id: 'hair_wavy_fringe', label: 'Wavy Fringe' },
      { id: 'hair_cowlick', label: 'Cowlick' },
      { id: 'hair_dreadlocks', label: 'Side Locs' },
      { id: 'hair_curtains', label: 'Center Curtains' }
    ]
  },

  dressUp: {
    tails: [
      { id: 'tail_none', label: 'No Tail' },
      { id: 'tail_fluffy', label: 'Fluffy Tail' },
      { id: 'tail_short', label: 'Short Tail' },
      { id: 'tail_cat', label: 'Cat Tail' },
      { id: 'tail_swirl', label: 'Curled Tail' },
      { id: 'tail_bushy', label: 'Bushy Tail' },
      { id: 'tail_fox', label: 'Fox Tail' },
      { id: 'tail_dragon', label: 'Dragon Tail' },
      { id: 'tail_lion', label: 'Lion Tail' },
      { id: 'tail_heart', label: 'Heart Tail' },
      { id: 'tail_star', label: 'Star Tail' },
      { id: 'tail_devil', label: 'Devil Tail' },
      { id: 'tail_fish', label: 'Fish Tail' },
      { id: 'tail_beaver', label: 'Beaver Tail' },
      { id: 'tail_sprout', label: 'Sprout Tail' }
    ],
    neckBags: [
      { id: 'neck_none', label: 'None' },
      { id: 'neck_towel', label: 'Towel' },
      { id: 'neck_cape', label: 'Cloak' },
      { id: 'neck_scarf', label: 'Scarf' },
      { id: 'neck_bell', label: 'Bell' },
      { id: 'neck_bowtie', label: 'Bow Tie' },
      { id: 'neck_pochette', label: 'Pochette' },
      { id: 'neck_overalls', label: 'Overalls' },
      { id: 'neck_hoodie', label: 'Hoodie' },
      { id: 'neck_apron', label: 'Apron' },
      { id: 'neck_lei', label: 'Flower Lei' },
      { id: 'neck_backpack', label: 'Backpack' },
      { id: 'neck_medal', label: 'Gold Medal' }
    ],
    props: [
      { id: 'prop_none', label: 'None' },
      { id: 'prop_sasumata', label: 'Sasumata' },
      { id: 'prop_wand', label: 'Star Wand' },
      { id: 'prop_boba', label: 'Boba Tea' },
      { id: 'prop_lollipop', label: 'Lollipop' },
      { id: 'prop_onigiri', label: 'Onigiri' },
      { id: 'prop_balloon', label: 'Heart Balloon' },
      { id: 'prop_plush', label: 'Mini Plush' }
    ],
    backgrounds: [
      { id: 'bg_meadow', label: 'Meadow' },
      { id: 'bg_night', label: 'Starry Night' },
      { id: 'bg_sakura', label: 'Sakura' },
      { id: 'bg_sunset', label: 'Sunset' },
      { id: 'bg_pastel', label: 'Cozy Pastel' }
    ]
  },

  personalitySliders: [
    { id: 'bravery', left: 'Timid', right: 'Brave' },
    { id: 'sociability', left: 'Prefers Alone', right: 'Loves Friends' },
    { id: 'talkative', left: 'Quiet', right: 'Chatty' },
    { id: 'energy', left: 'Laid-back', right: 'Energetic' }
  ]
};

function createDefaultCharacterState() {
  return {
    name: '',
    bodyColor: '#FFFFFF',
    pointColor: '#5D4037',
    shape: 'shape_normal',
    pattern: 'pat_none',
    eyeStyle: 'eye_round',
    eyebrowStyle: 'brow_follow',
    mouthStyle: 'mouth_follow',
    marking: 'mark_none',
    glasses: 'glasses_none',
    blushStyle: 'blush_classic',
    eyeSpacing: 50,
    featureHeight: 50,
    eyebrowTilt: 50,
    earType: 'ear_round',
    earUsePoint: false,
    headAccessory: 'acc_none',
    hairType: 'hair_none',
    tailType: 'tail_none',
    tailUsePoint: false,
    neckBag: 'neck_none',
    handProp: 'prop_none',
    background: 'bg_meadow',
    personality: {
      bravery: 65,
      sociability: 70,
      talkative: 50,
      energy: 60
    },
    rotationAngle: 0 // 0 = front, 90 = right, 180 = back, 270 = left
  };
}
