# Propuesta para ampliar Firestore Rules (NO DESPLEGADA)

El proyecto actual ya define las funciones `admin()` y `sucursalValida(s)`. Después de revisar las reglas completas existentes, agregar el siguiente `match` **dentro de** `match /databases/{database}/documents`, sin reemplazar las reglas existentes. Verificar el resultado en el simulador de reglas y con cuentas de prueba autorizada/no autorizada. No aplicar sin permiso de la dueña.

```js
match /uki_operacion_v1/{sucursal} {
  allow get: if admin() && sucursalValida(sucursal);
  allow list, delete: if false;

  function manifiestoValido() {
    return admin() && sucursalValida(sucursal)
      && request.resource.data.keys().hasOnly([
        'branch','schemaVersion','rev','generacion','salt',
        'totalBloques','actualizadoPor'
      ])
      && request.resource.data.keys().hasAll([
        'branch','schemaVersion','rev','generacion','salt',
        'totalBloques','actualizadoPor'
      ])
      && request.resource.data.branch == sucursal
      && request.resource.data.schemaVersion == 2
      && request.resource.data.rev is int
      && request.resource.data.generacion is string
      && request.resource.data.generacion.matches('^[a-f0-9]{32}$')
      && request.resource.data.salt is string
      && request.resource.data.salt.size() >= 20
      && request.resource.data.salt.size() <= 28
      && request.resource.data.totalBloques is int
      && request.resource.data.totalBloques >= 1
      && request.resource.data.totalBloques <= 180
      && request.resource.data.actualizadoPor == request.auth.uid;
  }

  allow create: if manifiestoValido()
    && request.resource.data.rev == 1;
  allow update: if manifiestoValido()
    && request.resource.data.rev == resource.data.rev + 1
    && request.resource.data.salt == resource.data.salt
    && request.resource.data.generacion != resource.data.generacion;

  match /bloques/{id} {
    allow get: if admin() && sucursalValida(sucursal);
    allow list, update, delete: if false;
    allow create: if admin() && sucursalValida(sucursal)
      && request.resource.data.keys().hasOnly([
        'branch','generacion','indice','formato','paquete'
      ])
      && request.resource.data.keys().hasAll([
        'branch','generacion','indice','formato','paquete'
      ])
      && request.resource.data.branch == sucursal
      && request.resource.data.generacion is string
      && request.resource.data.generacion.matches('^[a-f0-9]{32}$')
      && id.matches('^[a-f0-9]{32}_[0-9]{4}$')
      && request.resource.data.indice is int
      && request.resource.data.indice >= 0
      && request.resource.data.indice < 180
      && request.resource.data.formato == 'uki-cloud-chunk-v1'
      && request.resource.data.paquete is string
      && request.resource.data.paquete.size() > 0
      && request.resource.data.paquete.size() < 350000;
  }
}
```

**Importante:** evaluar expresamente que el uso compartido de una cuenta Google proporciona los mismos permisos en ambos locales y no identifica a cada trabajador; verificar que `admin()` siga exigiendo correo verificado y proveedor Google. Confirmar plan y posibles costos antes de activar el guardado frecuente.
