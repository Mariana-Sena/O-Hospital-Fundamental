// 1. Todos os dados e o valor médio das consultas do ano de 2020 e das que foram feitas sob convênio
db.consultas.aggregate([
    {
      $match: {
        $or: [
          { data_consulta: { $gte: new Date("2020-01-01"), $lt: new Date("2021-01-01") } },
          { convenios: { $exists: true } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        dadosConsultas: { $push: "$$ROOT" },
        mediaValor: { $avg: "$valor_consulta" }
      }
    }
  ]);

// 2. Todos os dados das internações que tiveram data de alta maior que a data prevista para a alta
db.internacoes.find({
    data_alta_real: { $gt: "$data_alta_prevista" }
  });

// 3. Receituário completo da primeira consulta registrada com receituário associado
db.consultas.find({ receituario: { $exists: true } }).sort({ data_consulta: 1 }).limit(1);

// 4. Todos os dados da consulta de maior valor e também da de menor valor (ambas as consultas não foram realizadas sob convênio)
db.consultas.aggregate([
    { $match: { convenios: { $exists: false } } },
    {
      $group: {
        _id: null,
        consultaMaiorValor: { $max: "$$ROOT" },
        consultaMenorValor: { $min: "$$ROOT" }
      }
    }
  ]);

// 5. Todos os dados das internações em seus respectivos quartos, calculando o total da internação a partir do valor de diária do quarto e o número de dias entre a entrada e a alta
db.internacoes.aggregate([
    {
      $lookup: {
        from: "quartos",
        localField: "quarto",
        foreignField: "id_quarto",
        as: "detalhes_quarto"
      }
    },
    {
      $addFields: {
        total_internacao: {
          $multiply: [
            { $arrayElemAt: ["$detalhes_quarto.valor_diaria", 0] },
            { $subtract: ["$duracao_dias"] }
          ]
        }
      }
    }
  ]);

// 6. Data, procedimento e número de quarto de internações em quartos do tipo “apartamento”
db.internacoes.aggregate([
    {
      $lookup: {
        from: "quartos",
        localField: "quarto",
        foreignField: "id_quarto",
        as: "detalhes_quarto"
      }
    },
    {
      $match: { "detalhes_quarto.tipo": "Apartamento" }
    },
    {
      $project: {
        data_internacao: 1,
        procedimento: "$motivo",
        numero_quarto: "$quarto"
      }
    }
  ]);

// 7. Nome do paciente, data da consulta e especialidade de todas as consultas em que os pacientes eram menores de 18 anos na data da consulta e cuja especialidade não seja “pediatria”, ordenando por data de realização da consulta
db.consultas.aggregate([
    {
      $lookup: {
        from: "pacientes",
        localField: "paciente_id",
        foreignField: "id_paciente",
        as: "detalhes_paciente"
      }
    },
    {
      $addFields: {
        idade_na_consulta: {
          $subtract: [
            { $year: "$data_consulta" },
            { $year: { $arrayElemAt: ["$detalhes_paciente.data_nascimento", 0] } }
          ]
        }
      }
    },
    {
      $match: {
        idade_na_consulta: { $lt: 18 },
        especialidade: { $ne: "Pediatria" }
      }
    },
    {
      $sort: { data_consulta: 1 }
    },
    {
      $project: {
        nome_paciente: { $arrayElemAt: ["$detalhes_paciente.nome", 0] },
        data_consulta: 1,
        especialidade: 1
      }
    }
  ]);

// 8. Nome do paciente, nome do médico, data da internação e procedimentos das internações realizadas por médicos da especialidade “gastroenterologia”, que tenham acontecido em “enfermaria”
db.internacoes.aggregate([
    {
      $lookup: {
        from: "medicos",
        localField: "medico_id",
        foreignField: "id_medico",
        as: "detalhes_medico"
      }
    },
    {
      $lookup: {
        from: "pacientes",
        localField: "paciente_id",
        foreignField: "id_paciente",
        as: "detalhes_paciente"
      }
    },
    {
      $lookup: {
        from: "quartos",
        localField: "quarto",
        foreignField: "id_quarto",
        as: "detalhes_quarto"
      }
    },
    {
      $match: {
        "detalhes_medico.especialidade": "Gastroenterologia",
        "detalhes_quarto.tipo": "Enfermaria"
      }
    },
    {
      $project: {
        nome_paciente: { $arrayElemAt: ["$detalhes_paciente.nome", 0] },
        nome_medico: { $arrayElemAt: ["$detalhes_medico.nome", 0] },
        data_internacao: 1,
        procedimento: "$motivo"
      }
    }
  ]);

// 9. Os nomes dos médicos, seus CRMs e a quantidade de consultas que cada um realizou
db.consultas.aggregate([
    {
      $group: {
        _id: "$medico_id",
        quantidade_consultas: { $count: {} }
      }
    },
    {
      $lookup: {
        from: "medicos",
        localField: "_id",
        foreignField: "id_medico",
        as: "detalhes_medico"
      }
    },
    {
      $project: {
        nome_medico: { $arrayElemAt: ["$detalhes_medico.nome", 0] },
        crm: { $arrayElemAt: ["$detalhes_medico.crm", 0] },
        quantidade_consultas: 1
      }
    }
  ]);

// 10. Todos os médicos que tenham "Gabriel" no nome
db.medicos.find({ nome: /Gabriel/i });

// 11. Os nomes, CORENs e número de internações de enfermeiros que participaram de mais de uma internação
db.internacoes.aggregate([
    { $unwind: "$enfermeiros" },
    {
      $group: {
        _id: "$enfermeiros.id_enfermeiro",
        total_internacoes: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "enfermeiros",
        localField: "_id",
        foreignField: "id_enfermeiro",
        as: "detalhes_enfermeiro"
      }
    },
    {
      $match: { total_internacoes: { $gt: 1 } }
    },
    {
      $project: {
        nome_enfermeiro: { $arrayElemAt: ["$detalhes_enfermeiro.nome", 0] },
        coren: { $arrayElemAt: ["$detalhes_enfermeiro.coren", 0] },
        total_internacoes: 1
      }
    }
  ]);

