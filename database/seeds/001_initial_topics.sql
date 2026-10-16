INSERT INTO public.temas ("numTema", "typeTema")
SELECT temas."numTema", tipos."typeTema"
FROM (VALUES
    ('Penal', 64),
    ('Civil', 94),
    ('Constitucional', 29)
) AS tipos("typeTema", cantidad)
CROSS JOIN LATERAL generate_series(1, tipos.cantidad) AS temas("numTema")
WHERE NOT EXISTS (
    SELECT 1
    FROM public.temas AS existente
    WHERE existente."typeTema" = tipos."typeTema"
      AND existente."numTema" = temas."numTema"
);
