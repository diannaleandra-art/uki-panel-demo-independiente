'use strict';
// Snapshot local del catálogo de Uki aprobado, solo para los artículos base de inventario.
// No usa imports de la carpeta public/ en el runtime serverless.
module.exports={
  "prices": {
    "12": 3800,
    "24": 8000,
    "36": 11800,
    "48": 15000,
    "60": 18000,
    "72": 21500,
    "84": 26500,
    "96": 27000,
    "108": 29500
  },
  "premiumPrices": {
    "20": 13000,
    "30": 16500,
    "40": 20000,
    "50": 25000,
    "60": 27000,
    "70": 28000,
    "80": 30000,
    "100": 35000
  },
  "proteins": [
    [
      "Pollo",
      0
    ],
    [
      "Kanicama",
      0
    ],
    [
      "Berenjena crispy",
      0
    ],
    [
      "Cerdo",
      500
    ],
    [
      "Camarón",
      600
    ],
    [
      "Carne",
      1000
    ],
    [
      "Salmón",
      1800
    ],
    [
      "Pulpo",
      2000
    ]
  ],
  "premiumProteins": [
    [
      "Pollo",
      0
    ],
    [
      "Kanicama",
      0
    ],
    [
      "Cerdo",
      0
    ],
    [
      "Camarón",
      0
    ],
    [
      "Carne",
      0
    ],
    [
      "Salmón",
      0
    ],
    [
      "Pulpo",
      0
    ]
  ],
  "vegetables": [
    "Cebollín",
    "Ciboulette",
    "Palta",
    "Pepino",
    "Pimentón",
    "Tomate",
    "Aceituna amarga",
    "Aceituna sin amargo",
    "Choclo",
    "Cilantro",
    "Cebolla caramelizada",
    "Champiñón",
    "Piña",
    "Palmito"
  ],
  "premiumVegetables": [
    "Cebollín",
    "Ciboulette",
    "Palta",
    "Albahaca",
    "Maní",
    "Pimentón",
    "Tomate",
    "Aceituna amarga",
    "Aceituna sin amargo",
    "Choclo",
    "Cilantro",
    "Cebolla caramelizada",
    "Ralladura de limón",
    "Champiñón",
    "Pepino",
    "Zanahoria",
    "Frutilla",
    "Palmito",
    "Pepinillo",
    "Piña",
    "Ají verde"
  ],
  "wraps": [
    [
      "Tempura",
      0
    ],
    [
      "Panko",
      0
    ],
    [
      "Ciboulette",
      0
    ],
    [
      "Sésamo",
      0
    ],
    [
      "Merkén",
      0
    ],
    [
      "Pepino",
      0
    ],
    [
      "Mixta",
      0
    ],
    [
      "Nori",
      0
    ],
    [
      "Queso",
      1000
    ],
    [
      "Palta",
      1000
    ],
    [
      "Queso maní",
      1300
    ],
    [
      "Queso ciboulette",
      1300
    ],
    [
      "Queso sésamo",
      1300
    ],
    [
      "Queso panko",
      1500
    ],
    [
      "Jamón serrano",
      2000
    ],
    [
      "Palta queso",
      2000
    ],
    [
      "Salmón ahumado",
      3000
    ],
    [
      "Salmón palta",
      2500
    ]
  ],
  "premiumWraps": [
    [
      "Tempura",
      0
    ],
    [
      "Panko",
      0
    ],
    [
      "Ciboulette",
      0
    ],
    [
      "Sésamo",
      0
    ],
    [
      "Merkén",
      0
    ],
    [
      "Mixta",
      0
    ],
    [
      "Nori",
      0
    ],
    [
      "Queso",
      1000
    ],
    [
      "Palta",
      1000
    ],
    [
      "Queso maní",
      1300
    ],
    [
      "Queso ciboulette",
      1300
    ],
    [
      "Queso sésamo",
      1300
    ],
    [
      "Queso panko",
      1500
    ],
    [
      "Jamón serrano",
      2000
    ],
    [
      "Palta queso",
      2000
    ],
    [
      "Salmón ahumado",
      3000
    ],
    [
      "Salmón palta",
      2500
    ]
  ],
  "pizzas": [
    {
      "id": "pepperoni",
      "name": "Pepperoni",
      "price": 9000,
      "ingredients": "Salsa napolitana, pepperoni, queso mozzarella y orégano."
    },
    {
      "id": "margarita",
      "name": "Margarita",
      "price": 9000,
      "ingredients": "Salsa napolitana, albahaca, tomate cherry, aceituna negra, queso mozzarella y orégano."
    },
    {
      "id": "mexicana",
      "name": "Mexicana",
      "price": 10900,
      "ingredients": "Salsa napolitana, carne, pico de gallo, ají verde, totopos, queso mozzarella y orégano."
    },
    {
      "id": "carnes",
      "name": "Carnes",
      "price": 12900,
      "ingredients": "Salsa napolitana, salame, pepperoni, tocineta, pimentón, queso mozzarella y orégano."
    },
    {
      "id": "hawaiana",
      "name": "Hawaiana",
      "price": 10900,
      "ingredients": "Salsa napolitana, piña caramelizada, jamón y queso mozzarella."
    },
    {
      "id": "mechada",
      "name": "Mechada",
      "price": 11900,
      "ingredients": "Salsa napolitana, carne mechada, aceituna negra, pimentón, queso mozzarella y orégano."
    },
    {
      "id": "ranchera",
      "name": "Ranchera",
      "price": 12900,
      "ingredients": "Salsa napolitana, pepperoni, chorizo, carne mechada, pimentón, queso mozzarella y orégano."
    },
    {
      "id": "pollo-bbq",
      "name": "Pollo BBQ-tocineta",
      "price": 11900,
      "ingredients": "Salsa napolitana, pollo BBQ, tocineta, maíz, queso mozzarella y orégano."
    },
    {
      "id": "vegetariana",
      "name": "Vegetariana",
      "price": 9900,
      "ingredients": "Salsa napolitana, aceituna, champiñón, cebolla, pimentón, queso mozzarella y orégano."
    },
    {
      "id": "espanola",
      "name": "Española",
      "price": 11900,
      "ingredients": "Salsa napolitana, tomate cherry, jamón serrano, queso parmesano, queso mozzarella y orégano."
    },
    {
      "id": "napolitana",
      "name": "Napolitana",
      "price": 8900,
      "ingredients": "Salsa napolitana, tomate, jamón, queso mozzarella y orégano."
    }
  ],
  "sauceNames": [
    "Soya",
    "Teriyaki"
  ],
  "extraSauceNames": [
    "Soya",
    "Teriyaki",
    "Wasabi",
    "Jengibre"
  ],
  "monthlyPromos": [
    {
      "id": "handroll-individual",
      "name": "Handroll a tu gusto",
      "price": 3800,
      "unit": "handroll",
      "rollCount": 1,
      "size": null,
      "sauceCount": 1,
      "korokes": 0,
      "standalone": true,
      "proteins": [
        "Pollo",
        "Kanicama",
        "Berenjena crispy"
      ],
      "wraps": [
        "Panko",
        "Tempura"
      ],
      "payments": [
        "efectivo",
        "transferencia",
        "debito",
        "edenred"
      ],
      "photo": "assets/handroll-tabla-real.jpeg"
    },
    {
      "id": "antojo-doble",
      "name": "Antojo doble",
      "price": 6800,
      "unit": "handroll",
      "rollCount": 2,
      "size": null,
      "sauceCount": 2,
      "korokes": 2,
      "proteins": [
        "Pollo",
        "Kanicama"
      ],
      "wraps": [
        "Panko",
        "Tempura"
      ],
      "payments": [
        "efectivo",
        "transferencia"
      ],
      "photo": "assets/antojo-doble-caricatura.png"
    },
    {
      "id": "sesenta-ahorro",
      "name": "Promo 60 piezas + 3 korokes",
      "price": 16000,
      "unit": "roll",
      "rollCount": 5,
      "size": 60,
      "sauceCount": 5,
      "korokes": 3,
      "proteins": [
        "Pollo",
        "Kanicama"
      ],
      "wraps": [
        "Tempura",
        "Panko",
        "Ciboulette",
        "Sésamo",
        "Merkén",
        "Pepino",
        "Mixta",
        "Nori"
      ],
      "payments": [
        "efectivo",
        "transferencia"
      ],
      "photo": "assets/promo-60-caricatura.png"
    },
    {
      "id": "sesenta-edenred",
      "name": "Promo Edenred · 60 piezas + 4 korokes",
      "price": 18000,
      "unit": "roll",
      "rollCount": 5,
      "size": 60,
      "sauceCount": 4,
      "korokes": 4,
      "proteins": [
        "Pollo",
        "Kanicama"
      ],
      "wraps": [
        "Tempura",
        "Panko",
        "Ciboulette",
        "Sésamo",
        "Merkén",
        "Pepino",
        "Mixta",
        "Nori"
      ],
      "payments": [
        "edenred"
      ],
      "photo": "assets/promo-edenred-caricatura.png"
    },
    {
      "id": "ciento-ocho-mes",
      "name": "Promo 108 piezas + 3 korokes + 8 salsas",
      "price": 27500,
      "unit": "roll",
      "rollCount": 9,
      "size": 108,
      "sauceCount": 8,
      "korokes": 3,
      "proteins": [
        "Pollo",
        "Kanicama"
      ],
      "wraps": [
        "Tempura",
        "Panko",
        "Ciboulette",
        "Sésamo",
        "Merkén",
        "Pepino",
        "Mixta",
        "Nori"
      ],
      "payments": [
        "efectivo",
        "transferencia"
      ],
      "photo": "/uki-promo-108-original.avif",
      "description": "9 rolls de 12 piezas. Pollo o kanicama incluidos, vegetal a elección, distintas envolturas. Solo efectivo o transferencia. Otros ingredientes pueden tener recargo."
    }
  ],
  "monthlyExtraProteins": [
    [
      "Cerdo",
      500
    ],
    [
      "Camarón",
      600
    ],
    [
      "Carne",
      1000
    ],
    [
      "Salmón",
      1800
    ],
    [
      "Pulpo",
      2000
    ]
  ],
  "monthlyExtraWraps": [
    [
      "Queso",
      1000
    ],
    [
      "Palta",
      1000
    ],
    [
      "Queso maní",
      1300
    ],
    [
      "Queso ciboulette",
      1300
    ],
    [
      "Queso sésamo",
      1300
    ],
    [
      "Queso panko",
      1500
    ],
    [
      "Jamón serrano",
      2000
    ],
    [
      "Palta queso",
      2000
    ],
    [
      "Salmón ahumado",
      3000
    ],
    [
      "Salmón palta",
      2500
    ]
  ],
  "dishes": [
    {
      "id": "korokes-4",
      "group": "entradas",
      "name": "4 korokes",
      "price": 2500,
      "description": ""
    },
    {
      "id": "gyozas-pollo",
      "group": "entradas",
      "name": "Gyozas de pollo",
      "price": 3000,
      "description": ""
    },
    {
      "id": "gyozas-camaron",
      "group": "entradas",
      "name": "Gyozas de camarón",
      "price": 3500,
      "description": ""
    },
    {
      "id": "alitas-papas",
      "group": "entradas",
      "name": "Alitas fritas con papas",
      "price": 7500,
      "description": ""
    },
    {
      "id": "papitas",
      "group": "entradas",
      "name": "Papitas fritas",
      "price": 2700,
      "description": "Porción."
    },
    {
      "id": "pollo-furay",
      "group": "entradas",
      "name": "Pollo furay con papas",
      "price": 6500,
      "description": ""
    },
    {
      "id": "gohan-vegetariano",
      "group": "gohan",
      "name": "Gohan vegetariano",
      "price": 5500,
      "description": "Base de arroz, dos vegetales a elección, palta, queso crema y salsas.",
      "vegetableCount": 2,
      "sauceChoice": true
    },
    {
      "id": "gohan-pollo",
      "group": "gohan",
      "name": "Gohan pollo teriyaki",
      "price": 6500,
      "description": "Base de arroz, pollo teriyaki apanado, palta, queso crema, un vegetal a elección y salsas.",
      "vegetableCount": 1,
      "sauceChoice": true
    },
    {
      "id": "gohan-camaron",
      "group": "gohan",
      "name": "Gohan camarón",
      "price": 7200,
      "description": "Base de arroz, camarón apanado, palta, queso crema, un vegetal a elección y salsas.",
      "vegetableCount": 1,
      "sauceChoice": true
    },
    {
      "id": "gohan-salmon",
      "group": "gohan",
      "name": "Gohan salmón",
      "price": 8000,
      "description": "Base de arroz, salmón marinado, palta, queso crema, un vegetal a elección y salsas.",
      "vegetableCount": 1,
      "sauceChoice": true
    },
    {
      "id": "sushi-burger",
      "group": "burger",
      "name": "Sushi Burger con papas",
      "price": 8000,
      "description": "Papas fritas, dos vegetales, queso crema, proteína a elección y salsa.",
      "vegetableCount": 2,
      "proteinChoice": true,
      "sauceChoice": true,
      "help": "Puedes agregar proteínas y vegetales extra con el recargo indicado."
    },
    {
      "id": "sushi-burger-promo",
      "group": "promo",
      "name": "Sushi Burguer · Promo del mes",
      "price": 5800,
      "description": "Incluye pollo o kanikama, 2 vegetales y salsa soya o teriyaki; otras proteínas tienen recargo.",
      "vegetableCount": 2,
      "proteinChoice": true,
      "sauceChoice": true
    }
  ],
  "toppings": [
    {
      "id": "topping-carne",
      "name": "Carne",
      "price": 3800
    },
    {
      "id": "topping-pollo",
      "name": "Pollo con vegetales",
      "price": 3000
    },
    {
      "id": "topping-cerdo",
      "name": "Cerdo teriyaki",
      "price": 3500
    },
    {
      "id": "topping-acevichado",
      "name": "Acevichado",
      "price": 4000
    },
    {
      "id": "topping-vegetales",
      "name": "Vegetales salteados",
      "price": 2500
    },
    {
      "id": "topping-repollo",
      "name": "Repollo",
      "price": 2800
    }
  ],
  "burgerExtraProteins": [
    [
      "Pollo",
      600
    ],
    [
      "Cerdo",
      800
    ],
    [
      "Camarón",
      1000
    ],
    [
      "Kanicama",
      500
    ],
    [
      "Berenjena crispy",
      500
    ],
    [
      "Carne",
      1800
    ],
    [
      "Salmón",
      2500
    ]
  ]
};
