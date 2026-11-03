"use strict";

(() => {
  const TICKET_COLUMNS = {
    id: "id",
    subject: "subject",
    categoryId: "category_id",
    type: "type",
    impact: "impact",
    urgency: "urgency",
    priority: "priority",
    status: "status",
    assignee: "assignee",
    communicationOwner: "communication_owner",
    channel: "channel",
    brand: "brand",
    orderId: "order_id",
    description: "description",
    requesterType: "requester_type",
    requesterName: "requester_name",
    requesterEmail: "requester_email",
    createdAt: "created_at",
    updatedAt: "updated_at",
    comments: "comments",
    firstResponseAt: "first_response_at",
    resolvedAt: "resolved_at",
    reopenedCount: "reopened_count",
    priorityChangedAt: "priority_changed_at",
  };
  const CATEGORY_COLUMNS = {
    id: "id",
    name: "name",
    type: "type",
    description: "description",
    reporter: "reporter",
    owner: "owner",
    createdAt: "created_at",
  };

  class ServiceDeskDataError extends Error {
    constructor(message, cause) {
      super(message, { cause });
      this.name = "ServiceDeskDataError";
      this.code = cause?.code;
    }
  }

  class TicketConflictError extends Error {
    constructor(ticketId) {
      super(`El ticket ${ticketId} cambió en otra sesión. Recarga la información antes de volver a guardar.`);
      this.name = "TicketConflictError";
      this.ticketId = ticketId;
    }
  }

  function mapRow(row, columns) {
    if (!row) return row;
    return Object.fromEntries(Object.entries(columns)
      .filter(([, column]) => Object.hasOwn(row, column))
      .map(([key, column]) => [key, row[column]]));
  }

  function mapPayload(value, columns) {
    return Object.fromEntries(Object.entries(columns)
      .filter(([key]) => Object.hasOwn(value, key))
      .map(([key, column]) => [column, value[key]]));
  }

  function throwDatabaseError(error, operation) {
    if (error) throw new ServiceDeskDataError(`No se pudo ${operation}: ${error.message || "error de base de datos"}`, error);
  }

  function createServiceDeskData(client) {
    if (!client?.from) throw new ServiceDeskDataError("La conexión a Supabase no está disponible.");
    return {
      async load() {
        const [ticketsResult, categoriesResult] = await Promise.all([
          client.from("tickets").select("*").order("created_at", { ascending: false }),
          client.from("custom_categories").select("*").order("name", { ascending: true }),
        ]);
        throwDatabaseError(ticketsResult.error, "cargar los tickets");
        throwDatabaseError(categoriesResult.error, "cargar las categorías");
        return {
          tickets: (ticketsResult.data || []).map((row) => mapRow(row, TICKET_COLUMNS)),
          customCategories: (categoriesResult.data || []).map((row) => mapRow(row, CATEGORY_COLUMNS)),
        };
      },

      async createTicket(ticketWithoutId) {
        const payload = mapPayload(ticketWithoutId, TICKET_COLUMNS);
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        const { data, error } = await client.from("tickets").insert(payload).select("*").single();
        throwDatabaseError(error, "crear el ticket");
        return mapRow(data, TICKET_COLUMNS);
      },

      async updateTicket(ticket, expectedUpdatedAt) {
        if (!ticket?.id || !expectedUpdatedAt) throw new ServiceDeskDataError("Falta la versión del ticket para guardar el cambio.");
        const payload = mapPayload(ticket, TICKET_COLUMNS);
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        const { data, error } = await client.from("tickets").update(payload)
          .eq("id", ticket.id)
          .eq("updated_at", expectedUpdatedAt)
          .select("*")
          .maybeSingle();
        throwDatabaseError(error, "actualizar el ticket");
        if (!data) throw new TicketConflictError(ticket.id);
        return mapRow(data, TICKET_COLUMNS);
      },

      async createCategory(category) {
        const payload = mapPayload(category, CATEGORY_COLUMNS);
        delete payload.created_at;
        const { data, error } = await client.from("custom_categories").insert(payload).select("*").single();
        throwDatabaseError(error, "guardar la categoría");
        return mapRow(data, CATEGORY_COLUMNS);
      },
    };
  }

  const client = window.bevstackSupabase;
  window.ServiceDeskData = {
    ...createServiceDeskData(client),
    ServiceDeskDataError,
    TicketConflictError,
    createServiceDeskData,
  };
})();
