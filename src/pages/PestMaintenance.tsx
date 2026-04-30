import { TabsContent, TabsList } from 'some-library';

// ... existing code

<TabsList>
  {/* Existing Tab triggers */}
  <TabsTrigger value="ppm" className="flex-1">PPM Schedule</TabsTrigger>
</TabsList>

// ... existing code

<TabsContent value="ppm" className="mt-4">
  <PPMScheduleEmbed siteId={siteId} organisationId={organisationId} />
</TabsContent>