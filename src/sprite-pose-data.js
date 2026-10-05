// All coordinates are measured on this pose's own original 1024 × 1536 art.
// No geometry or feature texture is inherited from idle.
const layers = pose => Object.fromEntries(['base', 'face_atlas', 'hair_front'].map(name => [name, `/sprites/${pose}/${name}.webp`]));
const frames = names => Object.fromEntries(names.split(' ').map((name, i) => [name, i]));
const ellipse = (zone, x, y, rx, ry) => ({ zone, ellipse: [x, y, rx, ry] });
const box = (zone, x, y, width, height) => ({ zone, rect: [x, y, width, height] });
const parts = (rect, eyes, brows, mouth) => {
  const region = ([x,y,w], h) => [x - rect.x - w/2 - 5, y - rect.y - h/2, w + 10, h];
  return { leftBrow: region(brows[0], 54), rightBrow: region(brows[1], 48),
    leftEye: region(eyes[0], 64), rightEye: region(eyes[1], 70), mouth: region(mouth, 60) };
};
const waveRect = { x:320, y:240, width:340, height:270 };
const pawsRect = { x:320, y:255, width:350, height:280 };
const cheerRect = { x:330, y:285, width:325, height:260 };
const tailRect = { x:340, y:295, width:325, height:265 };

export const poseData = {
  wave: {
    label:'挥手', layers:layers('wave'), faceRect:waveRect, grid:{columns:3,rows:2},
    frames:frames('smile happy talk blink wink'), defaultExpression:'smile', neutralEyes:'smile', neutralMouth:'smile',
    fallback:{content:'happy',coax:'smile',shy:'smile',surprised:'happy',sulky:'smile',pout:'smile',sleep:'blink'},
    parts:parts(waveRect,[[409,379,94],[568,337,91]],[[398,330,72],[550,287,66]],[516,438,42]),
    nose:[499,398,3,5],
    hair:{pivot:[445,167],path:'M345 240 C342 183 384 144 432 152 C513 140 565 201 613 275 L631 305 C600 306 574 286 549 265 C541 310 531 344 504 370 C487 387 470 395 453 388 C476 381 480 370 473 363 C440 352 416 324 401 294 C392 329 377 351 360 367 C345 337 338 289 345 240 Z'},
    headTop:[.46,.04],
    zones:[ellipse('bell',527,550,26,29),ellipse('chin',515,469,66,22),ellipse('cheek',430,411,28,20),ellipse('cheek',580,385,24,22),box('ear',175,75,170,185),box('ear',543,30,180,173),ellipse('head',477,268,252,243),box('tail',823,715,201,650)],
  },
  paws: {
    label:'托腮', layers:layers('paws'), faceRect:pawsRect, grid:{columns:3,rows:2},
    frames:frames('content coax shy happy talk blink'), defaultExpression:'coax', neutralEyes:'coax', neutralMouth:'coax',
    fallback:{smile:'coax',wink:'shy',surprised:'happy',sulky:'coax',pout:'shy',sleep:'content'},
    parts:parts(pawsRect,[[412,397,96],[571,349,98]],[[405,347,72],[550,307,67]],[520,455,44]),
    nose:[502,413,3,5],
    hair:{pivot:[445,173],path:'M347 255 C342 204 367 152 419 147 C502 134 563 206 620 295 L644 324 C609 324 577 301 553 276 C544 323 530 353 505 378 C488 395 473 402 451 397 C474 386 482 374 473 370 C444 357 420 330 402 302 C392 339 377 363 359 379 C347 344 341 297 347 255 Z'},
    headTop:[.46,.035],
    // Hands/cuffs are body. The narrow bell between the wrists is not a target.
    zones:[{zone:'body',polygon:[[347,407],[376,410],[411,458],[488,494],[500,579],[447,595],[414,527],[369,486],[350,453]]},box('body',596,386,70,220),ellipse('chin',518,489,49,18),ellipse('cheek',432,428,21,17),ellipse('cheek',583,396,19,19),box('ear',170,95,170,167),box('ear',550,30,170,166),ellipse('head',478,273,252,243),box('tail',825,713,199,644)],
  },
  cheer: {
    label:'欢呼', layers:layers('cheer'), faceRect:cheerRect, grid:{columns:2,rows:2},
    frames:frames('happy talk surprised blink'), defaultExpression:'happy', neutralEyes:'happy', neutralMouth:'happy',
    fallback:{smile:'happy',content:'happy',coax:'happy',shy:'happy',wink:'happy',sulky:'surprised',pout:'surprised',sleep:'blink'},
    parts:parts(cheerRect,[[413,418,90],[557,372,91]],[[405,366,72],[540,327,69]],[512,471,48]),
    nose:[500,428,3,5],
    hair:{pivot:[438,215],path:'M349 291 C343 235 367 197 416 187 C493 172 554 228 602 303 L627 341 C594 341 567 321 541 298 C536 342 524 373 502 396 C486 412 470 419 451 415 C474 405 479 395 471 389 C443 375 417 348 401 322 C393 358 378 382 360 398 C347 365 342 323 349 291 Z'},
    headTop:[.47,.06],
    zones:[box('body',0,0,196,700),box('body',770,0,254,780),ellipse('bell',526,581,25,28),ellipse('chin',515,507,60,19),ellipse('cheek',435,452,25,20),ellipse('cheek',570,410,24,20),box('ear',195,139,137,139),box('ear',525,105,138,153),ellipse('head',478,310,234,235),box('tail',813,746,211,650)],
  },
  tail: {
    label:'抱尾巴', layers:layers('tail'), faceRect:tailRect, grid:{columns:2,rows:2},
    frames:frames('sulky coax talk blink'), defaultExpression:'sulky', neutralEyes:'sulky', neutralMouth:'sulky',
    fallback:{smile:'coax',happy:'coax',content:'coax',shy:'coax',wink:'coax',surprised:'sulky',pout:'sulky',sleep:'blink'},
    parts:parts(tailRect,[[425,421,98],[585,376,95]],[[412,374,76],[571,330,69]],[528,482,35]),
    nose:[518,445,3,5],
    hair:{pivot:[455,203],path:'M357 280 C351 220 382 175 434 174 C516 162 577 231 625 316 L650 350 C617 350 587 328 562 302 C552 350 539 379 513 405 C496 421 481 429 461 422 C484 411 490 400 480 395 C451 382 428 355 411 326 C401 362 386 387 370 402 C355 369 350 323 357 280 Z'},
    headTop:[.48,.035],
    zones:[ellipse('bell',532,579,25,26),ellipse('chin',530,520,60,19),ellipse('cheek',444,454,25,18),ellipse('cheek',595,416,23,20),box('ear',185,110,162,162),box('ear',551,57,164,178),ellipse('head',494,299,257,250),ellipse('tail',678,618,128,77),box('tail',826,729,100,261)],
  },
};
