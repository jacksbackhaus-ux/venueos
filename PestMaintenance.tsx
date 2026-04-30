// Updates to PestMaintenance.tsx

const TabsList = () => {
  return (
    <Tabs>
      <TabsTrigger value="existing1">Existing Tab 1</TabsTrigger>
      <TabsTrigger value="existing2">Existing Tab 2</TabsTrigger>
      <TabsTrigger value="ppm" className="flex-1">PPM Schedule</TabsTrigger>
      {/* Other existing TabsTriggers */}
    </Tabs>
  );
};

// Other code...

const TabsContent = () => {
  return (
    <Tabs>
      {/* Other existing TabsContent */}
      <TabsContent value="ppm" className="mt-4">
        <PPMScheduleEmbed siteId={siteId} organisationId={organisationId} />
      </TabsContent>
    </Tabs>
  );
};